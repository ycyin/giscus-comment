---
title: 重温Spring---Spring AOP基于XML和注解的配置
date: 2021-07-11 00:02:33
tag:
  - Spring
  - AOP
  - Spring AOP
category: Spring
---

## 前言

上一篇学习了Spring AOP及其基本原理：[重温Spring---AOP动态代理和Spring AOP及其基本原理 | 敲代码的小松鼠 (ycyin.eu.org)](https://ycyin.eu.org/Spring/review-spring---aop-and-spring-aop)，本篇旨在记录基于XML和注解Spring AOP的方式。

## 基础代码准备

使用之前有的代码，一个有Service层和DAO层的增删改查例子，之前我们[通过基于JDK的动态代理实现了事务管理](https://ycyin.eu.org/Spring/review-spring---aop-and-spring-aop#servie-proxy)，这次使用Spring AOP来实现。

### pom.xml依赖包

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-context</artifactId>
        <version>5.0.2.RELEASE</version>
    </dependency>
    <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-test</artifactId>
        <version>5.0.2.RELEASE</version>
    </dependency>
    <dependency>
        <groupId>commons-dbutils</groupId>
        <artifactId>commons-dbutils</artifactId>
        <version>1.4</version>
    </dependency>

    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>5.1.6</version>
    </dependency>

    <dependency>
        <groupId>c3p0</groupId>
        <artifactId>c3p0</artifactId>
        <version>0.9.1.2</version>
    </dependency>

    <dependency>
        <groupId>junit</groupId>
        <artifactId>junit</artifactId>
        <version>4.12</version>
    </dependency>

    <dependency>
        <groupId>org.aspectj</groupId>
        <artifactId>aspectjweaver</artifactId>
        <version>1.8.7</version>
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
     * 查询所有
     * @return
     */
    List<Account> findAllAccount();

    /**
     * 查询一个
     * @return
     */
    Account findAccountById(Integer accountId);

    /**
     * 保存
     * @param account
     */
    void saveAccount(Account account);

    /**
     * 更新
     * @param account
     */
    void updateAccount(Account account);

    /**
     * 删除
     * @param acccountId
     */
    void deleteAccount(Integer acccountId);

    /**
     * 根据名称查询账户
     * @param accountName
     * @return  如果有唯一的一个结果就返回，如果没有结果就返回null
     *          如果结果集超过一个就抛异常
     */
    Account findAccountByName(String accountName);
}
```

### 账户持久层实现类

```java
/**
 * 账户的持久层实现类
 */
public class AccountDaoImpl implements IAccountDao {

    private QueryRunner runner;
    private ConnectionUtils connectionUtils;

    public void setRunner(QueryRunner runner) {
        this.runner = runner;
    }

    public void setConnectionUtils(ConnectionUtils connectionUtils) {
        this.connectionUtils = connectionUtils;
    }

    @Override
    public List<Account> findAllAccount() {
        try{
            return runner.query(connectionUtils.getThreadConnection(),"select * from account",new BeanListHandler<Account>(Account.class));
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public Account findAccountById(Integer accountId) {
        try{
            return runner.query(connectionUtils.getThreadConnection(),"select * from account where id = ? ",new BeanHandler<Account>(Account.class),accountId);
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void saveAccount(Account account) {
        try{
            runner.update(connectionUtils.getThreadConnection(),"insert into account(name,money)values(?,?)",account.getName(),account.getMoney());
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void updateAccount(Account account) {
        try{
            runner.update(connectionUtils.getThreadConnection(),"update account set name=?,money=? where id=?",account.getName(),account.getMoney(),account.getId());
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void deleteAccount(Integer accountId) {
        try{
            runner.update(connectionUtils.getThreadConnection(),"delete from account where id=?",accountId);
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public Account findAccountByName(String accountName) {
        try{
            List<Account> accounts = runner.query(connectionUtils.getThreadConnection(),"select * from account where name = ? ",new BeanListHandler<Account>(Account.class),accountName);
            if(accounts == null || accounts.size() == 0){
                return null;
            }
            if(accounts.size() > 1){
                throw new RuntimeException("结果集不唯一，数据有问题");
            }
            return accounts.get(0);
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
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
     * 查询所有
     * @return
     */
    List<Account> findAllAccount();

    /**
     * 查询一个
     * @return
     */
    Account findAccountById(Integer accountId);

    /**
     * 保存
     * @param account
     */
    void saveAccount(Account account);

    /**
     * 更新
     * @param account
     */
    void updateAccount(Account account);

    /**
     * 删除
     * @param acccountId
     */
    void deleteAccount(Integer acccountId);

    /**
     * 转账
     * @param sourceName        转出账户名称
     * @param targetName        转入账户名称
     * @param money             转账金额
     */
    void transfer(String sourceName,String targetName,Float money);

}
```

### 账户业务层实现类

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
    public List<Account> findAllAccount() {
       return accountDao.findAllAccount();
    }

    @Override
    public Account findAccountById(Integer accountId) {
        return accountDao.findAccountById(accountId);

    }

    @Override
    public void saveAccount(Account account) {
        accountDao.saveAccount(account);
    }

    @Override
    public void updateAccount(Account account) {
        accountDao.updateAccount(account);
    }

    @Override
    public void deleteAccount(Integer acccountId) {
        accountDao.deleteAccount(acccountId);
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
            // 模拟转账异常
            int i=1/0;

            //2.6更新转入账户
            accountDao.updateAccount(target);
    }
}
```

### 数据库连接工具类

```java
/**
 * 连接的工具类，它用于从数据源中获取一个连接，并且实现和线程的绑定
 */
public class ConnectionUtils {

    private ThreadLocal<Connection> tl = new ThreadLocal<Connection>();

    private DataSource dataSource;

    public void setDataSource(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * 获取当前线程上的连接
     * @return
     */
    public Connection getThreadConnection() {
        try{
            //1.先从ThreadLocal上获取
            Connection conn = tl.get();
            //2.判断当前线程上是否有连接
            if (conn == null) {
                //3.从数据源中获取一个连接，并且存入ThreadLocal中
                conn = dataSource.getConnection();
                tl.set(conn);
            }
            //4.返回当前线程上的连接
            return conn;
        }catch (Exception e){
            throw new RuntimeException(e);
        }
    }

    /**
     * 把连接和线程解绑
     */
    public void removeConnection(){
        tl.remove();
    }
}
```

### 与事务相关的类（通知类）

刚好五个方法，可对应Spring AOP的5种通知类型：前置通知（开启事务）、后置通知（提交事务）、异常通知（回滚事务）、最终通知（释放连接）、环绕通知（一般单独使用、包含了前面的4种）。

```java
/**
 * 和事务管理相关的工具类，它包含了，开启事务，提交事务，回滚事务和释放连接
 */
public class TransactionManager {

    private ConnectionUtils connectionUtils;

    public void setConnectionUtils(ConnectionUtils connectionUtils) {
        this.connectionUtils = connectionUtils;
    }

    /**
     * 开启事务
     */
    public void beginTransaction() {
        try {
            connectionUtils.getThreadConnection().setAutoCommit(false);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 提交事务
     */
    public void commit() {
        try {
            connectionUtils.getThreadConnection().commit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 回滚事务
     */
    public void rollback() {
        try {
            connectionUtils.getThreadConnection().rollback();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 释放连接
     */
    public void release() {
        try {
            connectionUtils.getThreadConnection().close();//还回连接池中
            connectionUtils.removeConnection();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 环绕通知
     *
     * @param pjp spring 框架为我们提供了一个接口：ProceedingJoinPoint，它可以作为环绕通知的方法参数。
     *            在环绕通知执行时，spring 框架会为我们提供该接口的实现类对象，我们直接使用就行。
     * @return
     */
    public Object transactionAround(ProceedingJoinPoint pjp) {
        //定义返回值
        Object rtValue = null;
        try {
            //获取方法执行所需的参数
            Object[] args = pjp.getArgs();
            //前置通知：开启事务
            beginTransaction();
            //执行方法
            rtValue = pjp.proceed(args);
            //后置通知：提交事务
            commit();
        } catch (Throwable e) {
            //异常通知：回滚事务
            rollback();
            e.printStackTrace();
        } finally {
            //最终通知：释放资源
            release();
        }
        return rtValue;
    }
}
```

### Spring配置文件

> bean.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
        http://www.springframework.org/schema/beans/spring-beans.xsd
        http://www.springframework.org/schema/aop
        http://www.springframework.org/schema/aop/spring-aop.xsd">


     <!-- 配置Service -->
    <bean id="accountService" class="com.yyc.service.impl.AccountServiceImpl">
        <!-- 注入dao -->
        <property name="accountDao" ref="accountDao"></property>
    </bean>


    <!--配置Dao对象-->
    <bean id="accountDao" class="com.yyc.dao.impl.AccountDaoImpl">
        <!-- 注入QueryRunner -->
        <property name="runner" ref="runner"></property>
        <!-- 注入ConnectionUtils -->
        <property name="connectionUtils" ref="connectionUtils"></property>
    </bean>

    <!--配置QueryRunner-->
    <bean id="runner" class="org.apache.commons.dbutils.QueryRunner" scope="prototype"></bean>

    <!-- 配置数据源 -->
    <bean id="dataSource" class="com.mchange.v2.c3p0.ComboPooledDataSource">
        <!--连接数据库的必备信息-->
        <property name="driverClass" value="com.mysql.jdbc.Driver"></property>
        <property name="jdbcUrl" value="jdbc:mysql://localhost:3306/ycyin"></property>
        <property name="user" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>

    <!-- 配置Connection的工具类 ConnectionUtils -->
    <bean id="connectionUtils" class="com.yyc.utils.ConnectionUtils">
        <!-- 注入数据源-->
        <property name="dataSource" ref="dataSource"></property>
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

<span style="color:red">此时的测试类也是可以运行的，但是无法实现事务管理。</span>

## 基于XML的AOP配置

### 第一步：把通知Bean交给spring来管理

通知类用 bean 标签配置起来

```xml
<!-- 第一步：配置事务管理器-->
<bean id="txManager" class="com.yyc.utils.TransactionManager">
    <!-- 注入ConnectionUtils -->
    <property name="connectionUtils" ref="connectionUtils"></property>
</bean>
```

### 第二步：使用`aop:config`声明aop配置

使用aop:config标签表明开始AOP的配置

```xml
<!--第二步：配置AOP-->
<aop:config>
   <!-- 配置的代码都写在此处 -->
</aop:config>
```

### 第三步：使用`aop:pointcut`配置切入点表达式

`aop:pointcut`
作用：用于配置切入点表达式。就是指定对哪些类的哪些方法进行增强。
属性：

- expression：用于定义切入点表达式。

- id：用于给切入点表达式提供一个唯一标识

```xml
<!--配置AOP-->
<aop:config>
      <!-- 第三步：配置切入点表达式-->
      <aop:pointcut expression="execution(* com.yyc.service.impl.*.*(..))" id="pt1"/>
</aop:config>
```

### 第四步：使用`aop:aspect`配置切面

`aop:aspect`
作用：用于配置切面。
属性：

- id：给切面提供一个唯一标识。
- ref：引用配置好的通知类 bean 的 id。

```xml
<!--配置AOP-->
<aop:config>
    <!-- 配置切入点表达式-->
     <aop:pointcut expression="execution(* com.yyc.service.impl.*.*(..))" id="pt1"/>
    <!-- 第四步：配置切面 -->
    <aop:aspect id="txAdvice" ref="txManager">
        <!-- 配置的代码都写在此处 -->
    </aop:aspect>
</aop:config>
```

### 第五步：使用`aop:xxx`配置对应的通知类型

`aop:before`
作用：用于配置前置通知。指定增强的方法在切入点方法之前执行
属性：

- method:用于指定通知类中的增强方法名称

- ponitcut-ref：用于指定切入点的表达式的引用

- poinitcut：用于指定切入点表达式

执行时间点：切入点方法执行之前执行

---------

`aop:after-returning`

作用：用于配置后置通知
属性：

- method：指定通知中方法的名称。

- pointct：定义切入点表达式

- pointcut-ref：指定切入点表达式的引用

执行时间点：
切入点方法正常执行之后。它和异常通知只能有一个执行

---------

`aop:after-throwing`
作用：用于配置异常通知
属性：

- method：指定通知中方法的名称。

- pointct：定义切入点表达式

- pointcut-ref：指定切入点表达式的引用

执行时间点：
切入点方法执行产生异常后执行。它和后置通知只能执行一个

---------

`aop:after`
作用：用于配置最终通知
属性：

- method：指定通知中方法的名称。

- pointct：定义切入点表达式

- pointcut-ref：指定切入点表达式的引用

执行时间点：
无论切入点方法执行时是否有异常，它都会在其后面执行。

---------

`aop:around`
作用：
用于配置环绕通知
属性：

- method：指定通知中方法的名称。

- pointct：定义切入点表达式

- pointcut-ref：指定切入点表达式的引用

说明：它是 spring 框架为我们提供的一种可以在代码中手动控制增强代码什么时候执行的方式。
<span style="color:red">注意：通常情况下，环绕通知都是独立使用的</span>

---------

```xml
<!--配置AOP-->
<aop:config>
    <aop:pointcut expression="execution(* com.yyc.service.impl.*.*(..))" id="pt1"/>
    <!--配置切面 -->
    <aop:aspect id="txAdvice" ref="txManager">
        <!-- 配置通知的类型，并且建立通知方法和切入点方法的关联-->
        <!-- <aop:before method="beginTransaction" pointcut-ref="pt1"></aop:before>-->
        <!-- <aop:after-returning method="commit" pointcut-ref="pt1"/>-->
        <!-- <aop:after-throwing method="rollback" pointcut-ref="pt1"/>-->
        <!-- <aop:after method="release" pointcut-ref="pt1"/>-->
        <aop:around method="transactionAround" pointcut-ref="pt1"/>
    </aop:aspect>
</aop:config>
```

## 基于注解的AOP配置

> 使用上面的基础代码

### 第一步：在Spring配置文件中导入context的名称空间

需要在Spring的配置文件中导入context的名称空间

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
http://www.springframework.org/schema/beans/spring-beans.xsd
http://www.springframework.org/schema/aop
http://www.springframework.org/schema/aop/spring-aop.xsd
http://www.springframework.org/schema/context
http://www.springframework.org/schema/context/spring-context.xsd">

    <!--配置QueryRunner-->
    <bean id="runner" class="org.apache.commons.dbutils.QueryRunner" scope="prototype"></bean>

    <!-- 配置数据源 -->
    <bean id="dataSource" class="com.mchange.v2.c3p0.ComboPooledDataSource">
        <!--连接数据库的必备信息-->
        <property name="driverClass" value="com.mysql.jdbc.Driver"></property>
        <property name="jdbcUrl" value="jdbc:mysql://localhost:3306/ycyin"></property>
        <property name="user" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>
    
</beans>
```

### 第二步：把资源使用注解配置

DAO持久层：

```java
/**
 * 账户的持久层实现类
 */
@Repository("accountDao")
public class AccountDaoImpl implements IAccountDao {

    @Autowired
    private QueryRunner runner;
    @Autowired
    private ConnectionUtils connectionUtils;
    
    // 省略...
}    
```

Service业务层：

```java
/**
 * 账户的业务层实现类
 *
 * 事务控制应该都是在业务层
 */
@Service("accountService")
public class AccountServiceImpl implements IAccountService{

    @Autowired
    private IAccountDao accountDao;
 
   // 省略...
}    
```

数据库连接工具类：

```java
@Component
public class ConnectionUtils {

    private ThreadLocal<Connection> tl = new ThreadLocal<Connection>();

    @Autowired
    private DataSource dataSource;
   
    // 省略...
}       
```

### 第三步：在Spring配置文件中指定 spring 要扫描的包

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
http://www.springframework.org/schema/beans/spring-beans.xsd
http://www.springframework.org/schema/aop
http://www.springframework.org/schema/aop/spring-aop.xsd
http://www.springframework.org/schema/context
http://www.springframework.org/schema/context/spring-context.xsd">


    <!-- 第三步：告知 spring，在创建容器时要扫描的包 -->
    <context:component-scan base-package="com.yyc"></context:component-scan>

    <!--配置QueryRunner-->
    <bean id="runner" class="org.apache.commons.dbutils.QueryRunner" scope="prototype"></bean>

    <!-- 配置数据源 -->
    <bean id="dataSource" class="com.mchange.v2.c3p0.ComboPooledDataSource">
        <!--连接数据库的必备信息-->
        <property name="driverClass" value="com.mysql.jdbc.Driver"></property>
        <property name="jdbcUrl" value="jdbc:mysql://localhost:3306/ycyin"></property>
        <property name="user" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>
</beans>
```

### 第四步：把通知类也使用注解配置

```java
/**
 * 和事务管理相关的工具类，它包含了，开启事务，提交事务，回滚事务和释放连接
 */
@Component("txManager")
public class TransactionManager {

    @Autowired
    private ConnectionUtils connectionUtils;
 
    // 省略...
 }
```

### 第五步：在通知类上使用`@Aspect `注解声明为切面

```java
@Component("txManager")
@Aspect//表明当前类是一个切面类
public class TransactionManager {

    @Autowired
    private ConnectionUtils connectionUtils;
    
    // 省略...
 }
```

### 第六步：在增强的方法上使用注解配置通知

`@Before`
作用：把当前方法看成是前置通知。
属性：
value：用于指定切入点表达式，还可以指定切入点表达式的引用。

------

`@AfterReturning`
作用：把当前方法看成是后置通知。
属性：
value：用于指定切入点表达式，还可以指定切入点表达式的引用

------

`@AfterThrowing`
作用：把当前方法看成是异常通知。
属性：
value：用于指定切入点表达式，还可以指定切入点表达式的引用

------

`@After`
作用：把当前方法看成是最终通知。
属性：
value：用于指定切入点表达式，还可以指定切入点表达式的引用

-------

<span style="color:red">注意：通常情况下，环绕通知都是独立使用的，所以这里先不配环绕通知</span>

```java
@Component("txManager")
@Aspect//表明当前类是一个切面类
public class TransactionManager {

    @Autowired
    private ConnectionUtils connectionUtils;

    public void setConnectionUtils(ConnectionUtils connectionUtils) {
        this.connectionUtils = connectionUtils;
    }

    /**
     * 开启事务
     */
    @Before("execution(* com.yyc.service.impl.*.*(..))")
    public void beginTransaction() {
        try {
            connectionUtils.getThreadConnection().setAutoCommit(false);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 提交事务
     */
    @AfterReturning("execution(* com.yyc..service.impl.*.*(..))")
    public void commit() {
        try {
            connectionUtils.getThreadConnection().commit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 回滚事务
     */
    @AfterThrowing("execution(* com.yyc.service.impl.*.*(..))")
    public void rollback() {
        try {
            connectionUtils.getThreadConnection().rollback();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    /**
     * 释放连接
     */
    @After("execution(* com.yyc.service.impl.*.*(..))")
    public void release() {
        try {
            connectionUtils.getThreadConnection().close();//还回连接池中
            connectionUtils.removeConnection();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 环绕通知
     *
     */
    // 省略...
}
```

### 第七步：在 spring 配置文件中开启 spring 对注解 AOP 的支持

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
http://www.springframework.org/schema/beans/spring-beans.xsd
http://www.springframework.org/schema/aop
http://www.springframework.org/schema/aop/spring-aop.xsd
http://www.springframework.org/schema/context
http://www.springframework.org/schema/context/spring-context.xsd">


    <!-- 告知 spring，在创建容器时要扫描的包 -->
    <context:component-scan base-package="com.yyc"></context:component-scan>

    <!--配置QueryRunner-->
    <bean id="runner" class="org.apache.commons.dbutils.QueryRunner" scope="prototype"></bean>

    <!-- 配置数据源 -->
    <bean id="dataSource" class="com.mchange.v2.c3p0.ComboPooledDataSource">
        <!--连接数据库的必备信息-->
        <property name="driverClass" value="com.mysql.jdbc.Driver"></property>
        <property name="jdbcUrl" value="jdbc:mysql://localhost:3306/ycyin"></property>
        <property name="user" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>

    <!-- 开启 spring 对注解 AOP 的支持 -->
    <aop:aspectj-autoproxy/>
</beans>
```

### 环绕通知注解配置

`@Around`
作用：把当前方法看成是环绕通知。
属性：
value：用于指定切入点表达式，还可以指定切入点表达式的引用。

------

<span style="color:red">注意：通常情况下，环绕通知都是独立使用的，所以这里需要先将其它的通知注释掉</span>

```java
@Component("txManager")
@Aspect//表明当前类是一个切面类
public class TransactionManager {

    @Autowired
    private ConnectionUtils connectionUtils;

    public void setConnectionUtils(ConnectionUtils connectionUtils) {
        this.connectionUtils = connectionUtils;
    }

    /**
     * 开启事务
     */
    // @Before("execution(* com.yyc.service.impl.*.*(..))")
    public void beginTransaction() {
        try {
            connectionUtils.getThreadConnection().setAutoCommit(false);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // 省略...

    /**
     * 环绕通知
     *
     * @param pjp spring 框架为我们提供了一个接口：ProceedingJoinPoint，它可以作为环绕通知的方法参数。
     *            在环绕通知执行时，spring 框架会为我们提供该接口的实现类对象，我们直接使用就行。
     * @return
     */
    @Around("execution(* com.yyc.service.impl.*.*(..))")
    public Object transactionAround(ProceedingJoinPoint pjp) {
        //定义返回值
        Object rtValue = null;
        try {
            //获取方法执行所需的参数
            Object[] args = pjp.getArgs();
            //前置通知：开启事务
            beginTransaction();
            //执行方法
            rtValue = pjp.proceed(args);
            //后置通知：提交事务
            commit();
        } catch (Throwable e) {
            //异常通知：回滚事务
            rollback();
            e.printStackTrace();
        } finally {
            //最终通知：释放资源
            release();
        }
        return rtValue;
    }
}
```

### 切入点表达式注解

`@Pointcut`
作用：指定切入点表达式
属性：
value：指定表达式的内容

------

使用方式如下：

```java
/**
 * 和事务管理相关的工具类，它包含了，开启事务，提交事务，回滚事务和释放连接
 */
@Component("txManager")
@Aspect//表明当前类是一个切面类
public class TransactionManager {

    @Autowired
    private ConnectionUtils connectionUtils;

    @Pointcut("execution(* com.yyc.service.impl.*.*(..))")
    private void pt1() {}

    // 省略...

    /**
     * 环绕通知
     *
     * @param pjp spring 框架为我们提供了一个接口：ProceedingJoinPoint，它可以作为环绕通知的方法参数。
     *            在环绕通知执行时，spring 框架会为我们提供该接口的实现类对象，我们直接使用就行。
     * @return
     */
    @Around("pt1()")
    public Object transactionAround(ProceedingJoinPoint pjp) {
        //定义返回值
        Object rtValue = null;
        try {
            //获取方法执行所需的参数
            Object[] args = pjp.getArgs();
            //前置通知：开启事务
            beginTransaction();
            //执行方法
            rtValue = pjp.proceed(args);
            //后置通知：提交事务
            commit();
        } catch (Throwable e) {
            //异常通知：回滚事务
            rollback();
            e.printStackTrace();
        } finally {
            //最终通知：释放资源
            release();
        }
        return rtValue;
    }
}
```

### 不使用 XML 的配置方式（纯注解）

> 把数据源的配置使用配置类配置

目前从spring的xml配置文件中可以看出，需要解决的问题有三个：

1. 数据源的配置，解决方法：使用`@Configuration`，`@Import(JdbcConfig.class)`，`@PropertySource("classpath:jdbcConfig.properties")`等注解
2. 包扫描，解决方法：使用`@Configuration`，`@ComponentScan("com.yyc")`等注解
3. 开启spring 对注解 AOP 的支持，解决方法：使用`@EnableAspectJAutoProxy`注解

jdbcConfig.properties：

```properties
jdbc.driver=com.mysql.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/ycyin
jdbc.username=root
jdbc.password=1234
```

JdbcConfig作为子配置类：

```java
/**
 * 和spring连接数据库相关的配置类
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
     * 用于创建一个QueryRunner对象
     * @param dataSource
     * @return
     */
    @Bean(name="runner")
    @Scope("prototype")
    public QueryRunner createQueryRunner(@Qualifier("ds2") DataSource dataSource){
        return new QueryRunner(dataSource);
    }

    /**
     * 创建数据源对象
     * @return
     */
    @Bean(name="ds2")
    public DataSource createDataSource(){
        try {
            ComboPooledDataSource ds = new ComboPooledDataSource();
            ds.setDriverClass(driver);
            ds.setJdbcUrl(url);
            ds.setUser(username);
            ds.setPassword(password);
            return ds;
        }catch (Exception e){
            throw new RuntimeException(e);
        }
    }
}

```

SpringConfiguration作为父配置类：

```java
@Configuration
@ComponentScan("com.yyc")
@Import(JdbcConfig.class)
@PropertySource("classpath:jdbcConfig.properties")
@EnableAspectJAutoProxy
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

## 错误

当使用非环绕通知配置AOP时，可能会出现错误<span style="color:red">com.mysql.jdbc.exceptions.jdbc4.MySQLNonTransientConnectionException: Can't call rollback when autocommit=true</span>，导致无法实现事务回滚。原因是：Spring通知执行顺序问题，先执行了最终通知再执行的后置通知，我们这里最终通知就是释放连接而后置通知是提交事务，在最终通知中关闭了连接后在后置通知中又获取了一个新的连接再去提交事务就会报错。

通过实验发现，这个问题当我们使用`Spring  5.2.7.RELEASE`的时候就可以解决这个问题，原因暂时不知道呢？有木有小伙伴知道欢迎在右上方留言板留言或在[About the MySQLNonTransientConnectionException,Below version 5.2.7.RELEASE of Spring - Stack Overflow](https://stackoverflow.com/questions/68405218/about-the-mysqlnontransientconnectionexception-below-version-5-2-7-release-of-sp) 中回复。

## *参考*

1. 重学Spring参考黑马57期Spring部分内容
2. 总结我之前在[博客园](https://www.cnblogs.com/hyyq/)初学Spring的系列文章，本篇总结得更好、更完整、更易懂、理解更深入。
3. 本文源码下载：<a :href="$withBase('/code/spring-aop-ycyin.zip')" download="spring-aop-ycyin.zip">点击下载</a>

