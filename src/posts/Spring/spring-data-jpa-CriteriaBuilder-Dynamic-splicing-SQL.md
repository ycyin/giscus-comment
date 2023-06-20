---
title: Spring Data Jpa 中使用CriteriaBuilder动态拼接SQL
date: 2022-03-08 18:06:13
tag:
  - Spring Data Jpa
  - Spring Boot
category: Spring Data Jpa
---

之前在我的博客园[Spring data jpa - 随笔分类 - 敲代码的小松鼠 - 博客园 (cnblogs.com)](https://www.cnblogs.com/hyyq/category/1015791.html)有记录过相关技巧问题，之前的应用场景太简单，重新记录一篇。

### 应用场景

&emsp;&emsp;在Spring Data Jpa中，可以使用提供的[Spring Data JPA - query-methods](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#jpa.query-methods)进行方便的查询，甚至可以使用`@Query`注解自己写HQL或SQL完成更复杂的数据库操作。但是这些都很难实现动态拼接SQL（即where条件中某个参数没有值就不添加这个条件）。<!--more-->

在这个场景下，我们需要返回自定义的结果（即非实体结果），这在我之前的博客中有记录可以直接通过`@Query`注解自己定义HQL实现[Spring Data Jpa 返回自定义对象（实体部分属性、多表联查） | 敲代码的小松鼠 (ladybug.top)](https://ladybug.top/Spring/spring-data-jpa-return-custom-objects.html)，本文记录另一种可以通过CriteriaBuilder实现。同时我们通过CriteriaBuilder实现动态拼接SQL，在大多复杂的业务场景中都需要动态拼接Where查询条件。

本篇文章以实体类（UserPO）为主，根据department字段分组sum计算moneyCount字段查询为例，这实体类在<a href="#end">文章末尾</a>提供。

### 封装字段

首先根据需求先将返回的两个字段（分组的department和计算后的值count）封装为一个对象(MoneyCount)，这个对象不需要加任何注解。

```java
/**
 * 统计Money数
 */
public class MoneyCount {
    /**
     * department号
     */
    private String department;
    /**
     * money数
     */
    private Long count;

    public MoneyCount() {
    }

    public MoneyCount(String department, Long count) {
        this.department = department;
        this.count = count;
    }

    // 省略getter、setter
}
```

### 使用JPA的Criteria API实现查询

> 参考：[Spring Data JPA - Reference Documentation](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#specifications)
>
> [SpringBoot使用JPA自定义Query多表动态查询_西方黑灵梦-CSDN博客](https://blog.csdn.net/BlackReimu/article/details/113263559)
>
> [Spring-data-Jpa分组分页求和查询_AAXXWX的博客-CSDN博客](https://blog.csdn.net/AAXXWX/article/details/120193758)
>
> [spring-data-jpa带括号的复杂查询写法_Lovme_du的博客-CSDN博客_jpa 括号](https://blog.csdn.net/qq_35719898/article/details/103630769)

#### 注入EntityManager

```java
@Component
public class UserDao {

    @PersistenceContext
    EntityManager em;
    
    // ...
}    
```

#### 具体的方法实现

```java
private List<SegmentCount> countSegments(final LocalDateTime startDate, final LocalDateTime endDate,
                                         final String billId, final String type,
                                         final List<Integer> agentIds, final List<String> corpCodes,
                                         final List<String> exCorpCodes){
    // 1 EntityManager获取CriteriaBuilder
    CriteriaBuilder cb = em.getCriteriaBuilder();
    // 2 CriteriaBuilder创建CriteriaQuery 指定查询返回，如果返回就是实体直接写实体.class
    // 如果是更新 CriteriaUpdate<...> update = cb.createCriteriaUpdate(...class)
    CriteriaQuery<MoneyCount> query = cb.createQuery(MoneyCount.class);
    // 3 CriteriaQuery指定要查询的表，得到Root<UserInfo>，Root代表要查询的表
    Root<UserPO> userPoRoot = query.from(UserPO.class);
    // 4 设置要查询的字段（注意要和Root指定的实体中的字段一致）
    // 如果是更新 update.set(userPoRoot.get("billId"), billId)
    query.multiselect(userPoRoot.get("department"),cb.sum(userPoRoot.get("moneyCount").as(Long.class)));
    // 5 创建where查询条件
    List<Predicate> predicateWhereList = new ArrayList<>();

    // 5.1 使用or(Predicate... restrictions)多个参数生成的SQL会打上括号
    List<Predicate> tTimeWhereList = new ArrayList<>();
    tTimeWhereList.add(cb.greaterThanOrEqualTo(userPoRoot.get("tTime"),startDate));
    tTimeWhereList.add(cb.lessThan(userPoRoot.get("tTime"),endDate));

    Predicate predicate = cb.and(tTimeWhereList.toArray(new Predicate[2]));
    predicateWhereList.add(cb.or(predicate,cb.equal(userPoRoot.get("billId"),billId)));

    predicateWhereList.add(cb.and(cb.equal(userPoRoot.get("type"), type)));

    predicateWhereList.add(cb.and(userPoRoot.get("agentId").in(agentIds)));

    // 根据业务逻辑corpCodes和exCorpCodes这两个值可能为空，动态拼入SQL
    if (CollectionUtils.isNotEmpty(corpCodes)) {
        predicateWhereList.add(cb.and(userPoRoot.get("corpCode").in(corpCodes)));
    }

    if (CollectionUtils.isNotEmpty(exCorpCodes)) {
        predicateWhereList.add(cb.not(userPoRoot.get("corpCode").in(exCorpCodes)));
    }

    // 6 指定where查询条件
    query.where(predicateWhereList.toArray(predicateWhereList.toArray(new Predicate[predicateWhereList.size()])) );
    // 7 指定groupBy条件
    query.groupBy(userPoRoot.get("department"));
    // 8 查询结果返回
    // 如果是更新 em.createQuery(update).executeUpdate()
    return  em.createQuery(query).getResultList();
}
```

上面的方法就实现了一个动态拼接的SQL查询（其中`AND (t.CORP_CODE IN (?, ?))`和`AND (t.CORP_CODE NOT IN (?, ?))`是动态的），实际生成执行的SQL是：

```sql
SELECT t.DEPARTMENT AS COL_0_0_, SUM(CAST(t.MONEY_COUNT AS number(19, 0))) AS COL_1_0_
FROM T_TABLE_USER t
WHERE (t.T_TIME >= ? AND t.T_TIME < ? OR t.BILL_ID = ?)
   AND t.TYPE = ?
   AND (t.AGENT_ID IN (?, ?))
   AND (t.CORP_CODE IN (?, ?))
   AND (t.CORP_CODE NOT IN (?, ?))
 GROUP BY t.DEPARTMENT
```

### 使用JpaSpecificationExecutor实现

可以参考之前我在博客园的文章[SpringBoot中使用Spring Data Jpa 实现简单的动态查询的两种方法](https://www.cnblogs.com/hyyq/p/6986797.html)和上面的逻辑实现。核心逻辑差不多。



<i id="end">附录：</i>

这里贴上实体类(省略toString()、getters和setters)：

UserPO：

```java
@Entity
@Table(name = "T_TABLE_USER")
@EntityListeners(AuditingEntityListener.class)
public class UserPO implements Serializable {

    /**
     * 主键ID
     */
    @Id
    private String id;

    /**
     * 代理人ID
     */
    private Integer agentId;

    /**
     * 所属账单ID
     */
    private String billId;

    /**
     * 类型
     */
    private String type;

    /**
     * 来源
     */
    private String source;

    /**
     * 出生日期
     */
    private LocalDateTime tTime;

    /**
     * department号
     */
    private String department;

    /**
     * 公司编码
     */
    private String corpCode;

    /**
     * 金额数
     */
    private Integer moneyCount;

    /**
     * 创建时间
     */
    @CreatedDate
    private LocalDateTime createTime;

    /**
     * 修改时间
     */
    @LastModifiedDate
    private LocalDateTime updateTime;
}
```
