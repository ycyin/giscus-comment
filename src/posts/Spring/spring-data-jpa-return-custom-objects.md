---
title: Spring Data Jpa 返回自定义对象（实体部分属性、多表联查）
date: 2020-04-22 08:00:39
tag:
  - Spring Data Jpa
  - Spring Boot
category: Spring Data Jpa
---

### 应用场景

&emsp;&emsp;在Spring data jpa中，一般都是直接返回一个实体或者List<实体>或者Page<实体>，这里的实体一般就是与数据库对应的实体类，就像下面这样：

```java
@Repository
public interface IUserDao extends JpaRepository<User, String>, JpaSpecificationExecutor<User>,
        PagingAndSortingRepository<User, String>, Serializable {
    @Override
    Page<User> findAll(Pageable pageable);
    @Override
    List<User> findAll();
    @Override
    User save(User u);
}    
```

在某些应用场景下，比如我只返回<font color=red>实体的部分属性</font>或者<font color=red>多表联查（join）多个表字段</font>怎么操作呢？<!--more-->

本篇文章以两个关联的实体类（User和Score）多表联查（join）t_user表中的id和user_name字段、t_score表中的score字段为例，这两个实体类在<a href="#end">文章末尾</a>提供。

### 封装字段

首先需要将返回的三个字段（t_user表中的id和user_name字段、t_score表中的score字段）封装为一个对象(TestView)，这个对象不需要加任何注解。

```java
public class TestView {
    private String id;
    private String name;
    private Integer score;
    public TestView() {
    }
    public TestView(String id, String name, Integer score) {
        this.id = id;
        this.name = name;
        this.score = score;
    }
    @Override
    public String toString() {
        return "TestView{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", score=" + score +
                '}';
    }
}
```

### 实现查询

> 参考：[Spring Data JPA - Reference Documentation]( https://docs.spring.io/spring-data/jpa/docs/2.2.6.RELEASE/reference/html/#repositories.custom-implementations )
>
> [Spring Data Jpa 复杂查询总结 (多表关联 以及 自定义分页 )]( https://blog.csdn.net/qq_36144258/article/details/80298354 )
>
> [Spring Data Jpa多表查询返回自定义实体]( https://blog.csdn.net/qq_36144258/article/details/80296512 )
>
> [HQL查询实体部分属性]( https://blog.csdn.net/qq_37844454/article/details/93539662 )

#### 方法一、使用HQL语句<font color=red>(推荐)</font>

`spring data jpa`接口中的方法：

```java
@Query(value="select new com.test.ycyin.entity.TestView(t1.id,t1.userName,t2.score)               from User t1 Left Join Score t2 on t1.id = t2.userId")
Page<TestView> findUserAndScore(Pageable pageable);
```

从上面的SQL中可以看出我们需要`t1.id,t1.userName,t2.score`这三个字段，我们还可以只查询`TestView`类中的两个字段，就像下面这样：

```java
@Query(value="select new com.test.ycyin.entity.TestView(t1.id,t1.userName) from User               t1 Left Join Score t2 on t1.id = t2.userId")
Page<TestView> findUserAndScore(Pageable pageable);
```

同时需要在`TestView`类中提供相应字段的构造方法。这样返回的值只有两个，其它字段则是`NULL`。你可以将两个表的字段都封装在一个类中，然后生成多个构造方法，今后查询的时候需要哪几个字段就使用哪个构造方法。

测试方法：

```java
Sort.Order order = new Sort.Order(Sort.Direction.ASC, "id").nullsLast();// 排序规则
Pageable pageable = PageRequest.of(0,10, Sort.by(order)); // 分页规则
List<TestView> content1 = userDao.findUserAndScore(pageable).getContent(); // 获取List
content1.forEach(u->{ System.out.println(u.toString()); }); 
```

另外，接口中可以直接返回`List<TestView>`也是可以的，见下：

```java
@Query(value="select new com.test.ycyin.entity.TestView(t1.id,t1.userName) from User               t1 Left Join Score t2 on t1.id = t2.userId")
List<TestView> findUserAndScore2(Pageable pageable);
```

#### 方法二、使用原生SQL

多表联查中，使用原生SQL的方式只能返回`Object[]`类型，需要我们手动去转。

`spring data jpa`接口中方法：

```java
@Query(value="select t1.id as id,t1.user_name as name ,t2.score as score from t_user                   t1 Left Join t_score t2 on t1.id = t2.user_id", nativeQuery = true)
Page<Object[]> findUserAndScore(Pageable pageable);
```

从上面的SQL中可以看出我们只需要t_user表中的id和user_name字段、t_score表中的score字段，并且使用了`left join`来联表查询。

转换方法：

```java
    //转换实体类
    public static <T> List<T> castEntity(List<Object[]> list, Class<T> clazz) throws Exception {
        List<T> returnList = new ArrayList<T>();
        if(CollectionUtils.isEmpty(list)){
            return returnList;
        }
        Object[] co = list.get(0);
        Class[] c2 = new Class[co.length];
        //确定构造方法
        for (int i = 0; i < co.length; i++) {
            if(co[i]!=null){
                c2[i] = co[i].getClass();
            }else {
                c2[i]=String.class;
            }
        }
        for (Object[] o : list) {
            Constructor<T> constructor = clazz.getConstructor(c2);
            returnList.add(constructor.newInstance(o));
        }
        return returnList;
    }
```

测试方法：

```java
Sort.Order order = new Sort.Order(Sort.Direction.ASC, "id").nullsLast();// 排序规则
Pageable pageable = PageRequest.of(0,10, Sort.by(order)); // 分页规则
Page<Object[]> all = userDao.findUserAndScore(pageable);// 返回Page<Object[]>
List<Object[]> content = all.getContent();// 获取返回的数据
List<TestView> testViews = castEntity(content, TestView.class); //转换objcet[] to TestView
System.out.println(testViews.toString());
```



<i id="end">附录：</i>

这里贴上两个实体类(省略toString()、getters和setters)：

User：

```java
@Entity
@Table(name = "t_user")
@DynamicUpdate()
public class User{

	/**
	 * id:代表唯一的记录
	 */
	@Id
	@Column(name = "id", columnDefinition = "varchar(36) comment'ID，UUID生成' ")
	private String id;

	/**
	 * 用户姓名
	 */
	@Column(name = "user_name", columnDefinition = "varchar(255) comment'用户姓名' ", nullable = false)
	private String userName;

	/**
	 * 用户密码
	 */
	@Column(name = "user_pass", columnDefinition = "varchar(255) comment'用户密码' ", nullable = false)
	private String userPass;

	/**
	 * gitlab账号
	 */
	@Column(name = "gitlab_acc", columnDefinition = "varchar(30) comment'gitlab账号' ")
	private String gitlabAcc;

	/**
	 *  电话
	 */
	@Column(name = "phone_number", columnDefinition = "char(11) comment'电话' ")
	private String phoneNumber;

	/**
	 * 邮箱
	 */
	@Column(name = "email_addr", columnDefinition = "varchar(30) comment'邮箱' ")
	private String emailAddr;
}
```

Score：

```java
@Entity
@Table(name = "t_score")
@DynamicUpdate()
public class Score {
    /**
     * id:代表唯一的记录
     */
    @Id
    @Column(name = "id", columnDefinition = "varchar(36) comment'ID，UUID生成' ")
    private String id;
    /**
     * userId
     */
    @Column(name = "user_id", columnDefinition = "varchar(36) comment'用户表ID' ")
    private String userId;
    /**
     * 分数
     */
    @Column(name = "score", columnDefinition = "int(8) comment'分数' ")
    private Integer score;

    /**
     * 学分
     */
    @Column(name = "credit", columnDefinition = "int(8) comment'学分' ")
    private Integer credit;
}
```

