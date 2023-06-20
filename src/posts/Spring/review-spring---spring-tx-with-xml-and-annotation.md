---
title: 重温Spring---Spring事务控制与基于XML和注解的配置方法
date: 2021-08-04 13:27:16
tag:
  - Spring
  - 事务控制
  - Spring AOP
category: Spring
---

## 前言

此前，我们学习了Spring AOP的配置方式：[重温Spring---Spring AOP基于XML和注解的配置 | 敲代码的小松鼠 (ladybug.top)](https://ladybug.top/Spring/review-spring---spring-aop-with-xml-and-annotation.html)，本篇旨在记录Spring事务控制的一些概念和基于XML和注解Spring 事务控制的方式。

## Spring事务管理的两种方式

事务主要是为了当代码出现异常情况时，可以保证数据的一致性。Spring 的事务控制都是基于 AOP 的，**spring支持编程式事务管理和声明式事务管理两种方式。**

- **编程式事务**使用`TransactionTemplate`或者直接使用底层的`PlatformTransactionManager`。对于编程式事务管理，spring推荐使用`TransactionTemplate`。
- **声明式事务**是建立在AOP之上的。其本质是对方法前后进行拦截，然后在目标方法开始之前创建或者加入一个事务，在执行完目标方法之后根据执行情况提交或者回滚事务。声明式事务最大的优点就是不需要通过编程的方式管理事务，这样就不需要在业务逻辑代码中掺杂事务管理的代码，只需在配置文件中做相关的事务规则声明(或通过基于`@Transactional`注解的方式)，便可以将事务规则应用到业务逻辑中。

显然声明式事务管理要优于编程式事务管理，这正是spring倡导的非侵入式的开发方式。声明式事务管理使业务代码不受污染，一个普通的POJO对象，只要加上注解就可以获得完全的事务支持。和编程式事务相比，声明式事务唯一不足地方是，它的最细粒度只能作用到方法级别，无法做到像编程式事务那样可以作用到代码块级别。但是即便有这样的需求，也存在很多变通的方法，比如，可以将需要进行事务管理的代码块独立为方法等等。

声明式事务管理也有两种常用的方式，一种是基于tx和aop名字空间的xml配置文件，另一种就是基于`@Transactional`注解。显然基于注解的方式更简单易用，更清爽。

## Spring事务特性

### PlatformTransactionManager

spring所有的事务管理策略类都继承自`org.springframework.transaction.PlatformTransactionManager`接口，它里面提供了我们常用的操作事务的方法。

```java
public interface PlatformTransactionManager {
    // 获取事务状态信息
    TransactionStatus getTransaction(TransactionDefinition var1) throws TransactionException;
    // 提交事务
    void commit(TransactionStatus var1) throws TransactionException;
    // 回滚事务
    void rollback(TransactionStatus var1) throws TransactionException;
}
```

我们在开发中都是使用它的实现类，例如:

1. `org.springframework.jdbc.datasource.DataSourceTransactionManager`： 使用 Spring JDBC 或 iBatis 进行持久化数据时使用

2. `org.springframework.orm.hibernate5.HibernateTransactionManager`：使用Hibernate 版本进行持久化数据时使用

### TransactionDefinition

`org.springframework.transaction.TransactionDefinition`它是事务的定义信息对象，里面有如下方法：

```java
// 获取事务传播行为
int getPropagationBehavior();
// 获取事务隔离级别
int getIsolationLevel();
// 获取事务超时时间
int getTimeout();
// 获取事务是否只读
boolean isReadOnly();
// 获取事务对象名称
String getName();
```

`TransactionDefinition`定义以下属性和特性：

**事务隔离级别**

隔离级别是指若干个并发的事务之间的隔离程度。TransactionDefinition 接口中定义了五个表示隔离级别的常量：

- TransactionDefinition.ISOLATION_DEFAULT：这是默认值，表示使用底层数据库的默认隔离级别。对大部分数据库而言，通常这值就是TransactionDefinition.ISOLATION_READ_COMMITTED。
- TransactionDefinition.ISOLATION_READ_UNCOMMITTED：该隔离级别表示一个事务可以读取另一个事务修改但还没有提交的数据。该级别不能防止脏读，不可重复读和幻读，因此很少使用该隔离级别。比如PostgreSQL实际上并没有此级别。
- TransactionDefinition.ISOLATION_READ_COMMITTED：该隔离级别表示一个事务只能读取另一个事务已经提交的数据。该级别可以防止脏读，这也是大多数情况下的推荐值。（Oracle默认）
- TransactionDefinition.ISOLATION_REPEATABLE_READ：该隔离级别表示一个事务在整个过程中可以多次重复执行某个查询，并且每次返回的记录都相同。该级别可以防止脏读和不可重复读。（MySQL默认）
- TransactionDefinition.ISOLATION_SERIALIZABLE：所有的事务依次逐个执行，这样事务之间就完全不可能产生干扰，也就是说，该级别可以防止脏读、不可重复读以及幻读。但是这将严重影响程序的性能。通常情况下也不会用到该级别。

**事务传播行为**

所谓事务的传播行为是指，如果在开始当前事务之前，一个事务上下文已经存在，此时有若干选项可以指定一个事务性方法的执行行为。在TransactionDefinition定义中包括了如下几个表示传播行为的常量：

- TransactionDefinition.PROPAGATION_REQUIRED：如果当前存在事务，则加入该事务；如果当前没有事务，则创建一个新的事务。这是默认值。
- TransactionDefinition.PROPAGATION_REQUIRES_NEW：创建一个新的事务，如果当前存在事务，则把当前事务挂起。
- TransactionDefinition.PROPAGATION_SUPPORTS：如果当前存在事务，则加入该事务；如果当前没有事务，则以非事务的方式继续运行。
- TransactionDefinition.PROPAGATION_NOT_SUPPORTED：以非事务方式运行，如果当前存在事务，则把当前事务挂起。
- TransactionDefinition.PROPAGATION_NEVER：以非事务方式运行，如果当前存在事务，则抛出异常。
- TransactionDefinition.PROPAGATION_MANDATORY：如果当前存在事务，则加入该事务；如果当前没有事务，则抛出异常。
- TransactionDefinition.PROPAGATION_NESTED：如果当前存在事务，则创建一个事务作为当前事务的嵌套事务来运行；如果当前没有事务，则该取值等价于TransactionDefinition.PROPAGATION_REQUIRED。

**事务超时**

所谓事务超时，就是指一个事务所允许执行的最长时间，如果超过该时间限制但事务还没有完成，则自动回滚事务。在 TransactionDefinition 中以 int 的值来表示超时时间，其单位是秒。

默认设置为底层事务系统的超时值，如果底层数据库事务系统没有设置超时值，那么默认为-1，没有超时限制。

**是否是只读事务**

建议查询时设置为只读。

### TransactionStatus

此接口描述了某个时间点上事务对象的状态信息，包含如下6个具体操作：

```java
// 刷新事务
void flush()
// 获取事务是否为新的事务
boolean isNewTransaction();
// 获取是否存在存储点
boolean hasSavepoint();
// 设置事务回滚
void setRollbackOnly();
// 获取事务是否回滚
boolean isRollbackOnly();
// 获取事务是否完成
boolean isCompleted();
```

### Spring事务回滚规则

默认配置下，spring只有在抛出的异常为运行时unchecked异常时才回滚该事务，也就是抛出的异常为RuntimeException的子类(Errors也会导致事务回滚)，而抛出checked异常则不会导致事务回滚。可以明确的配置在抛出哪些异常时回滚事务，包括checked异常。也可以明确定义那些异常抛出时不回滚事务。还可以编程性的通过setRollbackOnly()方法来指示一个事务必须回滚，在调用完setRollbackOnly()后你所能执行的唯一操作就是回滚。

## 基础代码准备

此前我们通过Spring AOP手动实现了一个账户转账的通知实例（事务回滚实例），也可以实现事务回滚，但是我们要自己去实现事务管理器、回滚的方式等。这次我们使用Spring 事务控制，通过配置Spring不需要写其它的非业务代码即可实现。下面是基础代码准备。

### pom.xml依赖包

需要加入spring-tx的包

```xml
 <dependencies>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>
            <version>5.0.2.RELEASE</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-jdbc</artifactId>
            <version>5.0.2.RELEASE</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-tx</artifactId>
            <version>5.0.2.RELEASE</version>
        </dependency>

        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-test</artifactId>
            <version>5.0.2.RELEASE</version>
        </dependency>

        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>5.1.6</version>
        </dependency>

        <dependency>
            <groupId>org.aspectj</groupId>
            <artifactId>aspectjweaver</artifactId>
            <version>1.8.7</version>
        </dependency>

        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.12</version>
        </dependency>
    </dependencies>
```

### 账户实体类

```java
/**
 * 账户的实体类
 */
public class Account implements Serializable {

    private Integer id;
    private String name;
    private Float money;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Float getMoney() {
        return money;
    }

    public void setMoney(Float money) {
        this.money = money;
    }

    @Override
    public String toString() {
        return "Account{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", money=" + money +
                '}';
    }
}
```

### 账户持久层接口

```java
/**
 * 账户的持久层接口
 */
public interface IAccountDao {

    /**
     * 根据Id查询账户
     * @param accountId
     * @return
     */
    Account findAccountById(Integer accountId);

    /**
     * 根据名称查询账户
     * @param accountName
     * @return
     */
    Account findAccountByName(String accountName);

    /**
     * 更新账户
     * @param account
     */
    void updateAccount(Account account);
}
```

### 账户持久层实现类

我们这里使用的是JdbcTemplate实现持久层操作数据库。

```java
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.support.JdbcDaoSupport;

import java.util.List;

/**
 * 账户的持久层实现类
 */
public class AccountDaoImpl extends JdbcDaoSupport implements IAccountDao {

    @Override
    public Account findAccountById(Integer accountId) {
        List<Account> accounts = super.getJdbcTemplate().query("select * from account where id = ?",new BeanPropertyRowMapper<Account>(Account.class),accountId);
        return accounts.isEmpty()?null:accounts.get(0);
    }

    @Override
    public Account findAccountByName(String accountName) {
        List<Account> accounts = super.getJdbcTemplate().query("select * from account where name = ?",new BeanPropertyRowMapper<Account>(Account.class),accountName);
        if(accounts.isEmpty()){
            return null;
        }
        if(accounts.size()>1){
            throw new RuntimeException("结果集不唯一");
        }
        return accounts.get(0);
    }

    @Override
    public void updateAccount(Account account) {
        super.getJdbcTemplate().update("update account set name=?,money=? where id=?",account.getName(),account.getMoney(),account.getId());
    }
}
```

### 账户业务层接口

```java
/**
 * 账户的业务层接口
 */
public interface IAccountService {
    /**
     * 根据id查询账户信息
     * @param accountId
     * @return
     */
    Account findAccountById(Integer accountId);

    /**
     * 转账
     * @param sourceName    转成账户名称
     * @param targetName    转入账户名称
     * @param money         转账金额
     */
    void transfer(String sourceName,String targetName,Float money);
}
```

### 账户业务层实现类

在转账操作中模拟一个异常，以验证我们的事务控制。

```java
/**
 * 账户的业务层实现类
 *
 * 事务控制应该都是在业务层
 */
public class AccountServiceImpl implements IAccountService{

    private IAccountDao accountDao;

    public void setAccountDao(IAccountDao accountDao) {
        this.accountDao = accountDao;
    }

    @Override
    public Account findAccountById(Integer accountId) {
        return accountDao.findAccountById(accountId);

    }


    @Override
    public void transfer(String sourceName, String targetName, Float money) {
        System.out.println("transfer....");
            //2.1根据名称查询转出账户
            Account source = accountDao.findAccountByName(sourceName);
            //2.2根据名称查询转入账户
            Account target = accountDao.findAccountByName(targetName);
            //2.3转出账户减钱
            source.setMoney(source.getMoney()-money);
            //2.4转入账户加钱
            target.setMoney(target.getMoney()+money);
            //2.5更新转出账户
            accountDao.updateAccount(source);

            int i=1/0;

            //2.6更新转入账户
            accountDao.updateAccount(target);
    }
}
```

### Spring配置文件

> bean.xml 基础代码准备阶段，先配置好业务层和持久层以及数据源配置，【不要忘记导入spring 事务控制必须的tx命名空间】

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xsi:schemaLocation="
        http://www.springframework.org/schema/beans
        http://www.springframework.org/schema/beans/spring-beans.xsd
        http://www.springframework.org/schema/tx
        http://www.springframework.org/schema/tx/spring-tx.xsd
        http://www.springframework.org/schema/aop
        http://www.springframework.org/schema/aop/spring-aop.xsd">

    <!-- 配置业务层-->
    <bean id="accountService" class="com.yyc.service.impl.AccountServiceImpl">
        <property name="accountDao" ref="accountDao"></property>
    </bean>

    <!-- 配置账户的持久层并注入数据源-->
    <bean id="accountDao" class="com.yyc.dao.impl.AccountDaoImpl">
        <property name="dataSource" ref="dataSource"></property>
    </bean>


    <!-- 配置数据源-->
    <bean id="dataSource" class="org.springframework.jdbc.datasource.DriverManagerDataSource">
        <property name="driverClassName" value="com.mysql.jdbc.Driver"></property>
        <property name="url" value="jdbc:mysql://localhost:3306/ycyin"></property>
        <property name="username" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>

</beans>
```

### 测试类

```java
/**
 * 使用Junit单元测试：测试我们的配置
 */
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(locations = "classpath:bean.xml")
public class AccountServiceTest {

    @Autowired
    @Qualifier("accountService")
    private  IAccountService as;

    @Test
    public  void testTransfer(){
        as.transfer("aaa","bbb",100f);
    }

}
```

<span style="color:red">此时基础代码准备完成，测试类也是可以运行的，但是无法实现事务控制。</span>

## 基于XML的声明式事务控制配置

### 第一步：配置事务管理器

使用PlatformTransactionManager的实现类DataSourceTransactionManager作为事务管理器

```xml
<!-- 配置事务管理器 -->
<bean id="transactionManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
	<property name="dataSource" ref="dataSource"></property>
</bean>
```

### 第二步：配置事务的通知引用事务管理器

此时我们需要用到之前导入事务的约束 tx名称空间和约束，同时也需要aop的
使用tx:advice标签配置事务通知
属性：
id：给事务通知起一个唯一标识
transaction-manager：给事务通知提供一个事务管理器引用

```xml
<!-- 配置事务的通知 -->
<tx:advice id="txAdvice" transaction-manager="transactionManager">
    <!-- 这里配置事务的属性（隔离级别、传播行为等等） -->
</tx:advice>
```

### 第三步：配置事务的属性

在 `tx:advice` 标签内部 配置事务的属性

```xml
<!-- 配置事务的属性
        name：指定方法名称，一般是业务核心方法
        isolation：用于指定事务的隔离级别。默认值是DEFAULT，表示使用数据库的默认隔离级别。
        propagation：用于指定事务的传播行为。默认值是REQUIRED，表示一定会有事务，增删改的选择。查询方法可以选择SUPPORTS。
        read-only：用于指定事务是否只读。只有查询方法才能设置为true。默认值是false，表示读写。
        timeout：用于指定事务的超时时间，默认值是-1，表示永不超时。如果指定了数值，以秒为单位。
        rollback-for：用于指定一个异常，当产生该异常时，事务回滚，产生其他异常时，事务不回滚。没有默认值。表示任何异常都回滚。
        no-rollback-for：用于指定一个异常，当产生该异常时，事务不回滚，产生其他异常时事务回滚。没有默认值。表示任何异常都回滚。
-->
<tx:attributes>
    <tx:method name="*" propagation="REQUIRED" read-only="false"/>
    <tx:method name="find*" propagation="SUPPORTS" read-only="true"></tx:method>
</tx:attributes>
```

### 第四步：配置 AOP 切入点表达式

```xml
<!-- 配置aop-->
<aop:config>
    <!-- 配置切入点表达式-->
    <aop:pointcut id="pt1" expression="execution(* com.yyc.service.impl.*.*(..))"></aop:pointcut>
    <!--在这里配置建立切入点表达式和事务通知的对应关系 -->
</aop:config>
```

### 第五步：配置切入点表达式和事务通知的对应关系

在 `aop:config `标签内部：建立事务的通知和切入点表达式的关系

```xml
<!--在 aop:config 标签内部 建立切入点表达式和事务通知的对应关系 -->
<aop:advisor advice-ref="txAdvice" pointcut-ref="pt1"></aop:advisor>
```

### 事务控制部分xml配置

在基础代码准备阶段的Spring配置文件中，配置Spring事务的新增部分XML配置：

```xml
<!-- spring中基于XML的声明式事务控制配置步骤
        1、配置事务管理器
        2、配置事务的通知
                此时我们需要导入事务的约束 tx名称空间和约束，同时也需要aop的
                使用tx:advice标签配置事务通知
                    属性：
                        id：给事务通知起一个唯一标识
                        transaction-manager：给事务通知提供一个事务管理器引用
        3、配置AOP中的通用切入点表达式
        4、建立事务通知和切入点表达式的对应关系
        5、配置事务的属性
               是在事务的通知tx:advice标签的内部

     -->
    <!-- 配置事务管理器 -->
    <bean id="transactionManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
        <property name="dataSource" ref="dataSource"></property>
    </bean>

    <!-- 配置事务的通知-->
    <tx:advice id="txAdvice" transaction-manager="transactionManager">
        <!-- 配置事务的属性
                isolation：用于指定事务的隔离级别。默认值是DEFAULT，表示使用数据库的默认隔离级别。
                propagation：用于指定事务的传播行为。默认值是REQUIRED，表示一定会有事务，增删改的选择。查询方法可以选择SUPPORTS。
                read-only：用于指定事务是否只读。只有查询方法才能设置为true。默认值是false，表示读写。
                timeout：用于指定事务的超时时间，默认值是-1，表示永不超时。如果指定了数值，以秒为单位。
                rollback-for：用于指定一个异常，当产生该异常时，事务回滚，产生其他异常时，事务不回滚。没有默认值。表示任何异常都回滚。
                no-rollback-for：用于指定一个异常，当产生该异常时，事务不回滚，产生其他异常时事务回滚。没有默认值。表示任何异常都回滚。
        -->
        <tx:attributes>
            <tx:method name="*" propagation="REQUIRED" read-only="false"/>
            <tx:method name="find*" propagation="SUPPORTS" read-only="true"></tx:method>
        </tx:attributes>
    </tx:advice>

    <!-- 配置aop-->
    <aop:config>
        <!-- 配置切入点表达式-->
        <aop:pointcut id="pt1" expression="execution(* com.yyc.service.impl.*.*(..))"></aop:pointcut>
        <!--建立切入点表达式和事务通知的对应关系 -->
        <aop:advisor advice-ref="txAdvice" pointcut-ref="pt1"></aop:advisor>
    </aop:config>
```

## 基于注解的声明式事务控制配置

由于我们之前的基础代码中DAO层实现继承JdbcDaoSupport以使用JdbcTemplate，JdbcTemplate需要一个重要的参数就是数据源dataSource。使用xml配置时，通过如下代码轻松地将数据源注入JdbcDaoSupport中，具体Spring如何将数据源注入可以看这个大哥写的[Spring JdbcDaoSupport的注入问题JdbcTemple_CSDN博客](https://blog.csdn.net/qingfeng812/article/details/22674465)

```xml
<!-- 配置账户的持久层并注入数据源-->
<bean id="accountDao" class="com.yyc.dao.impl.AccountDaoImpl">
    <property name="dataSource" ref="dataSource"></property>
</bean>
```

使用注解后，上面一段xml配置会删除，取而代之的是使用`@Repository("accountDao")`注解的方式管理Bean，我们就需要更改注入数据源的方式，见下第0步：

### 第零步：修改JdbcTemplate中数据源注入方式

<span id="step0"></span>第一种方式：我们仍然是继承JdbcDaoSupport，然后在accountDao中注入数据源，需要使用如下方式，否则就会因为JdbcDaoSupport创建JdbcTemplate时需要dataSource而我们未提供而报错。`@PostConstruct`注解的使用可以看文章最后参考里的文章。

```java
@Repository("accountDao")
public class AccountDaoImpl extends JdbcDaoSupport implements IAccountDao {

    @Autowired
    private DataSource dataSource;

    @PostConstruct
    private void initialize() {
        super.setDataSource(dataSource);
    }
   // ....省略
}   
```

第二种方式：取消继承JdbcDaoSupport，我们自己注入一个JdbcTemplate，<span style="color:red">需要在xml配置文件或配置类中提供一个JdbcTemplate</span>。

```java
@Repository("accountDao")
public class AccountDaoImpl implements IAccountDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;
    
    // ....省略
}    
```

### 第一步：配置事务管理器并注入数据源

```xml
<!-- 配置事务管理器 -->
<bean id="transactionManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
	<property name="dataSource" ref="dataSource"></property>
</bean>
```

### 第二步：开启包扫描、开启对注解事务的支持

```xml
<!-- 配置spring创建容器时要扫描的包、一般放在配置第一行 -->
<context:component-scan base-package="com.yyc"></context:component-scan>
```

```xml
<!-- 开启spring对注解事务的支持-->
<tx:annotation-driven transaction-manager="transactionManager"></tx:annotation-driven>
```

### 第三步：在需要事务支持的地方使用`@Transactional`注解

`@Transactional` 可以作用于接口、接口方法、类以及类方法上。当作用于类上时，该类的所有 public 方法将都具有该类型的事务属性，同时，我们也可以在方法级别使用该注解来覆盖类级别的定义。

虽然 `@Transactional` 注解可以作用于接口、接口方法、类以及类方法上，但是 Spring 建议不要在接口或者接口方法上使用该注解，因为这只有在使用基于接口的代理时它才会生效。另外， `@Transactional` 注解应该只被应用到 public 方法上，这是由 Spring AOP 的本质决定的。如果你在 protected、private 或者默认可见性的方法上使用 `@Transactional` 注解，这将被忽略，也不会抛出任何异常。

我们这里业务实现类需要，我们就配置在AccountServiceImpl类以及方法上：

```java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 账户的业务层实现类
 *
 * 事务控制应该都是在业务层
 */
@Service("accountService")
@Transactional(propagation= Propagation.SUPPORTS,readOnly=true)//只读型事务的配置
public class AccountServiceImpl implements IAccountService{

    @Autowired
    private IAccountDao accountDao;

    @Override
    public Account findAccountById(Integer accountId) {
        return accountDao.findAccountById(accountId);

    }

    // 需要的是读写型事务配置(方法级别使用该注解来覆盖类级别的定义)
    @Transactional(propagation= Propagation.REQUIRED,readOnly=false)
    @Override
    public void transfer(String sourceName, String targetName, Float money) {
        System.out.println("transfer....");
            //2.1根据名称查询转出账户
            Account source = accountDao.findAccountByName(sourceName);
            //2.2根据名称查询转入账户
            Account target = accountDao.findAccountByName(targetName);
            //2.3转出账户减钱
            source.setMoney(source.getMoney()-money);
            //2.4转入账户加钱
            target.setMoney(target.getMoney()+money);
            //2.5更新转出账户
            accountDao.updateAccount(source);

            int i=1/0;

            //2.6更新转入账户
            accountDao.updateAccount(target);
    }
}
```

### 基于注解配置的完整的xml配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="
        http://www.springframework.org/schema/beans
        http://www.springframework.org/schema/beans/spring-beans.xsd
        http://www.springframework.org/schema/tx
        http://www.springframework.org/schema/tx/spring-tx.xsd
        http://www.springframework.org/schema/aop
        http://www.springframework.org/schema/aop/spring-aop.xsd
        http://www.springframework.org/schema/context
        http://www.springframework.org/schema/context/spring-context.xsd">

    <!-- 配置spring创建容器时要扫描的包-->
    <context:component-scan base-package="com.yyc"></context:component-scan>
    
    <!-- 配置JdbcTemplate-->
    <!-- 如果【第零步：修改JdbcTemplate中数据源注入方式】用的是第一种方式，就不用创建JdbcTemplate，而只需要数据源
    <bean id="jdbcTemplate" class="org.springframework.jdbc.core.JdbcTemplate">
        <property name="dataSource" ref="dataSource"></property>
    </bean>
    -->


    <!-- 配置数据源-->
    <bean id="dataSource" class="org.springframework.jdbc.datasource.DriverManagerDataSource">
        <property name="driverClassName" value="com.mysql.jdbc.Driver"></property>
        <property name="url" value="jdbc:mysql://localhost:3306/eesy"></property>
        <property name="username" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>

    <!-- spring中基于注解 的声明式事务控制配置步骤
        1、配置事务管理器
        2、开启spring对注解事务的支持
        3、在需要事务支持的地方使用@Transactional注解

     -->
    <!-- 配置事务管理器 -->
    <bean id="transactionManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
        <property name="dataSource" ref="dataSource"></property>
    </bean>

    <!-- 开启spring对注解事务的支持-->
    <tx:annotation-driven transaction-manager="transactionManager"></tx:annotation-driven>

</beans>
```

### 不使用 XML 的配置方式（纯注解）

> 把数据源的配置使用配置类配置

目前从spring的xml配置文件中可以看出，需要解决的问题有四个：

1. 数据源，以及注入问题，解决办法：使用`@Configuration`，`@Import(JdbcConfig.class)`，`@PropertySource("classpath:jdbcConfig.properties")`等注解使用配置类配置数据源，使用[第零步：修改JdbcTemplate中数据源注入方式](#step0)方式解决注入问题；

2. 事务管理器配置，解决方法：使用`@Configuration`，`@Import({TransactionConfig.class})`等注解使用配置类配置事务管理器；

3. 包扫描，解决方法：使用`@Configuration`，`@ComponentScan("com.yyc")`等注解

4. 开启spring 对注解 事务控制 的支持，解决方法：使用`@EnableTransactionManagement`注解

jdbcConfig.properties：

```properties
jdbc.driver=com.mysql.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/ycyin
jdbc.username=root
jdbc.password=1234
```

JdbcConfig作为数据源子配置类：

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import javax.sql.DataSource;

/**
 * 和连接数据库相关的配置类
 */
public class JdbcConfig {

    @Value("${jdbc.driver}")
    private String driver;

    @Value("${jdbc.url}")
    private String url;

    @Value("${jdbc.username}")
    private String username;

    @Value("${jdbc.password}")
    private String password;

    /**
     * 创建JdbcTemplate
       如果【第零步：修改JdbcTemplate中数据源注入方式】用的是第一种方式，就不用创建JdbcTemplate，而只需要数据源
     * @param dataSource
     * @return
     */
    /*
    @Bean(name="jdbcTemplate")
    public JdbcTemplate createJdbcTemplate(DataSource dataSource){
        return new JdbcTemplate(dataSource);
    }
    **/

    /**
     * 创建数据源对象
     * @return
     */
    @Bean(name="dataSource")
    public DataSource createDataSource(){
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setDriverClassName(driver);
        ds.setUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        return ds;
    }
}
```

TransactionConfig作为数据源子配置类：

```java
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;

/**
 * 和事务相关的配置类
 */
public class TransactionConfig {

    /**
     * 用于创建事务管理器对象
     * @param dataSource
     * @return
     */
    @Bean(name="transactionManager")
    public PlatformTransactionManager createTransactionManager(DataSource dataSource){
        return new DataSourceTransactionManager(dataSource);
    }
}
```

SpringConfiguration作为父配置类：

```java
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.PropertySource;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * spring的配置类，相当于bean.xml
 */
@Configuration
@ComponentScan("com.yyc")
@Import({JdbcConfig.class,TransactionConfig.class})
@PropertySource("jdbcConfig.properties")
@EnableTransactionManagement
public class SpringConfiguration {
}
```



<span style="color:red;font-size:1.5em">注意：数据库配置文件jdbcConfig.properties放到resources目录下、配置类放到需要扫描的包的上一层</span>

测试类：需要修改为`@ContextConfiguration(classes = SpringConfiguration.class)`

```java
/**
 * 使用Junit单元测试：测试我们的配置
 */
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(classes = SpringConfiguration.class)
// @ContextConfiguration(locations = "classpath:bean.xml")
public class AccountServiceTest {

    @Autowired
    @Qualifier("accountService")
    private  IAccountService as;

    @Test
    public  void testTransfer(){
        as.transfer("aaa","bbb",100f);
    }

}
```



## *参考*

1. [Spring的编程式事务和声明式事务 - nnngu - 博客园 (cnblogs.com)](https://www.cnblogs.com/nnngu/p/8627662.html)
2. [Spring JdbcDaoSupport的注入问题JdbcTemple -  CSDN博客](https://blog.csdn.net/qingfeng812/article/details/22674465)
3. [如何使用 AutoWire方式注入 JdbcDaoSupport DataSource - 博客园 (cnblogs.com)](https://www.cnblogs.com/zbw911/p/6530376.html)
4. [@PostConstruct注解_致终将逝去的编程青春-CSDN博客](https://blog.csdn.net/qq360694660/article/details/82877222)
5. 重学Spring参考黑马57期Spring部分内容
6. 总结我之前在[博客园](https://www.cnblogs.com/hyyq/)初学Spring的系列文章。

