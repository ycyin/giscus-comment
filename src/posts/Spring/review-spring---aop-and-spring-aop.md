---
title: 重温Spring---AOP动态代理和Spring AOP及其基本原理
date: 2021-07-10 21:30:12
tags:
  - Spring
  - AOP
  - Spring AOP
  - 事务
  - 动态代理
  - 切入点表达式
categories: Spring
---

## 前言

本篇旨在记录个人重新回去学习Spring AOP学到的一些东西，在这里记录一下。首先通过一个案例引出两个问题，然后通过依次解决这两个问题来简单了解Spring AOP原理（[动态代理](#Proxy)），随后了解[AOP基础](#aop)和[Spring AOP](#spring-aop)，最后分别基于XML和注解配置AOP。

## 案例

我们先来看一个烂大街的转账案例，看看在这个案例中会带来什么问题。我们仍然使用dbutils作为操作数据库的工具。

pom.xml配置：

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
</dependencies>
```

DAO持久层（省略接口IAccountDao的定义）：

```xml
    <!--配置Dao对象-->
    <bean id="accountDao" class="com.yyc.dao.impl.AccountDaoImpl">
        <!-- 注入QueryRunner -->
        <property name="runner" ref="runner"></property>
    </bean>

    <!--配置QueryRunner-->
    <bean id="runner" class="org.apache.commons.dbutils.QueryRunner" scope="prototype">
        <!--注入数据源-->
        <constructor-arg name="ds" ref="dataSource"></constructor-arg>
    </bean>

    <!-- 配置数据源 -->
    <bean id="dataSource" class="com.mchange.v2.c3p0.ComboPooledDataSource">
        <!--连接数据库的必备信息-->
        <property name="driverClass" value="com.mysql.jdbc.Driver"></property>
        <property name="jdbcUrl" value="jdbc:mysql://localhost:3306/ycyin"></property>
        <property name="user" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>
```



```java
public class AccountDaoImpl implements IAccountDao {

    private QueryRunner runner;

    public void setRunner(QueryRunner runner) {
        this.runner = runner;
    }

    // 省略一些其它方法

    @Override
    public void updateAccount(Account account) {
        try{
            runner.update("update account set name=?,money=? where id=?",account.getName(),account.getMoney(),account.getId());
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public Account findAccountByName(String accountName) {
        try{
            List<Account> accounts = runner.query("select * from account where name = ? ",new BeanListHandler<Account>(Account.class),accountName);
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

下面是我们的业务层方法（假设我们在其它地方没有配置任何有关事务的配置）：accountDao由Spring注入。

```xml
<!-- 配置Service -->
<bean id="accountService" class="com.yyc.service.impl.AccountServiceImpl">
    <!-- 注入dao -->
    <property name="accountDao" ref="accountDao"></property>
</bean>
```



```java
public void transfer(String sourceName, String targetName, Float money) {
    //根据名称查询两个账户信息
    Account source = accountDao.findByName(sourceName);
    Account target = accountDao.findByName(targetName);
    //转出账户减钱，转入账户加钱
    source.setMoney(source.getMoney()-money);
    target.setMoney(target.getMoney()+money);
    //更新两个账户
    accountDao.update(source);
    int i=1/0; //模拟转账异常
    accountDao.update(target);
}
```

### 案例存在的问题

上面案例中业务层的transfer方法表示将sourceName账户的钱转入targetName账户，但是在更新source账户后出现异常(/ by zero)导致无法更新target账户，最终导致转账失败，但是因为我们是每次执行持久层方法都是独立事务，导致无法实现事务控制（<span style="color:red">不符合事务的一致性</span>）。

这是因为事务被自动控制了。换言之，我们使用了 connection 对象默认的的 <span style="color:red">setAutoCommit(true)</span>，即自动提交事务。
此方式控制事务，如果我们每次都执行一条 sql 语句，没有问题，但是如果业务方法一次要执行多条 sql（就像上面这种情况）语句，这种方式就无法实现功能了。

<span style="color:red">解决办法：</span>让业务层来控制事务的提交和回滚。

### 解决案例中的问题

<span style="color:red">解决这个问题的直接方式就是给业务层加上事务，同时因为我们最终是为了让 connection 对象的 setAutoCommit(false)，所以应保证DAO数据持久层操作数据的connection对象是同一个。</span>

DAO持久层：runner和connectionUtils通过Spring注入。

```java
public class AccountDaoImpl implements IAccountDao {

    private QueryRunner runner;
    private ConnectionUtils connectionUtils;

    public void setRunner(QueryRunner runner) {
        this.runner = runner;
    }

    public void setConnectionUtils(ConnectionUtils connectionUtils) {
        this.connectionUtils = connectionUtils;
    }

     // 省略一些其它方法

    @Override
    public void updateAccount(Account account) {
        try{
            runner.update(connectionUtils.getThreadConnection(),"update account set name=?,money=? where id=?",account.getName(),account.getMoney(),account.getId());
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

下面是改造后的业务层方法：txManager和accountDao由Spring注入

```java
public void transfer(String sourceName, String targetName, Float money) {
    try {
        //1.开启事务
        txManager.beginTransaction();
        //2.执行操作

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
        //3.提交事务
        txManager.commit();

    }catch (Exception e){
        //4.回滚操作
        txManager.rollback();
        e.printStackTrace();
    }finally {
        //5.释放连接
        txManager.release();
    }
}
```

TransactionManager事务管理类：connectionUtils由Spring注入

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
    public  void beginTransaction(){
        try {
            connectionUtils.getThreadConnection().setAutoCommit(false);
        }catch (Exception e){
            e.printStackTrace();
        }
    }

    /**
     * 提交事务
     */
    public  void commit(){
        try {
            connectionUtils.getThreadConnection().commit();
        }catch (Exception e){
            e.printStackTrace();
        }
    }

    /**
     * 回滚事务
     */
    public  void rollback(){
        try {
            connectionUtils.getThreadConnection().rollback();
        }catch (Exception e){
            e.printStackTrace();
        }
    }


    /**
     * 释放连接
     */
    public  void release(){
        try {
            connectionUtils.getThreadConnection().close();//还回连接池中
            connectionUtils.removeConnection();
        }catch (Exception e){
            e.printStackTrace();
        }
    }
}
```

ConnectionUtils数据库连接工具类：dataSource由Spring注入

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

bean.xml配置文件：

```xml
<!-- 配置Service -->
<bean id="accountService" class="com.yyc.service.impl.AccountServiceImpl">
    <!-- 注入dao -->
    <property name="accountDao" ref="accountDao"></property>
    <property name="txManager" ref="txManager"></property>
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

<!-- 配置事务管理器-->
<bean id="txManager" class="com.yyc.utils.TransactionManager">
    <!-- 注入ConnectionUtils -->
    <property name="connectionUtils" ref="connectionUtils"></property>
</bean>
```

### 新的问题

通过对业务层和持久层的改造，已经可以实现事务控制了，但是由于我们添加了事务控制，也产生了一个新的问题：
业务层方法变得臃肿了，里面充斥着很多重复代码（我们这里只贴了一个业务层方法，其实一般我们开发中都会有多个，这里所说的重复代码具体就是指每个业务层方法都需要开启事务、提交事务、回滚事务和释放资源这些操作）。并且<span style="color:red">业务层方法和事务控制方法耦合了</span>。
试想一下，如果我们此时提交，回滚，释放资源中任何一个方法名变更，都需要修改业务层的代码，况且这还只是一个业务层实现类，而实际的项目中这种业务层实现类可能有十几个甚至几十个。

<span style="color:red">解决办法：</span>使用代理。

### 解决案例中新的问题

会用到JDK的动态代理先直接解决问题，后面我们回顾一下[动态代理](#Proxy)。这里需要创建一个Service业务层的代理对象BeanFactory：其中accountService和txManager由Spring注入：<span id="servie-proxy"></span>

```java
/**
 * 用于创建Service的代理对象的工厂
 */
public class BeanFactory {

    private IAccountService accountService;

    private TransactionManager txManager;

    public void setTxManager(TransactionManager txManager) {
        this.txManager = txManager;
    }


    public final void setAccountService(IAccountService accountService) {
        this.accountService = accountService;
    }

    /**
     * 获取Service代理对象
     * @return
     */
    public IAccountService getAccountService() {
        return (IAccountService)Proxy.newProxyInstance(accountService.getClass().getClassLoader(),
                accountService.getClass().getInterfaces(),
                new InvocationHandler() {
                    /**
                     * 添加事务的支持
                     *
                     * @param proxy
                     * @param method
                     * @param args
                     * @return
                     * @throws Throwable
                     */
                    @Override
                    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
						// 还可以忽略某个方法不开启事务，不让test方法开启事务，此时test方法只是连接点，但不是切入点，因为没有被增强
                        if("test".equals(method.getName())){
                            return method.invoke(accountService,args);
                        }

                        Object rtValue = null;
                        try {
                            //1.开启事务
                            txManager.beginTransaction();
                            //2.执行操作
                            rtValue = method.invoke(accountService, args);
                            //3.提交事务
                            txManager.commit();
                            //4.返回结果
                            return rtValue;
                        } catch (Exception e) {
                            //5.回滚操作
                            txManager.rollback();
                            throw new RuntimeException(e);
                        } finally {
                            //6.释放连接
                            txManager.release();
                        }
                    }
                });
    }
}
```

随后，我们在Bean.xml文件中增加配置：

```xml
<!--配置代理的service-->
<bean id="proxyAccountService" factory-bean="beanFactory" factory-method="getAccountService"></bean>

<!--配置beanfactory-->
<bean id="beanFactory" class="com.yyc.factory.BeanFactory">
    <!-- 注入service -->
    <property name="accountService" ref="accountService"></property>
    <!-- 注入事务管理器 -->
    <property name="txManager" ref="txManager"></property>
</bean>
```

这时可以删掉业务层方法中的臃肿代码了：

```java
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
```

最后我们使用Service业务层的时候，直接使用proxyAccountService这个业务层代理类即可实现事务。

```java
/**
 * 使用Junit单元测试：测试我们的配置
 */
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(locations = "classpath:bean.xml")
public class AccountServiceTest {

    @Autowired
    @Qualifier("proxyAccountService")
    // @Qualifier("accountService")
    private  IAccountService as;

    @Test
    public  void testTransfer(){
        as.transfer("aaa","bbb",100f);
    }

}
```

## 动态代理

### 动态代理的特点和作用 <span id="Proxy"></span>

字节码随用随创建，随用随加载。它与静态代理的区别也在于此。因为静态代理是字节码一上来就创建好，并完成加载。装饰者模式就是静态代理的一种体现。

作用：不修改源码的基础上对方法增强

### 动态代理常用的两种方式

**基于接口的动态代理：**

提供者：JDK 官方的 Proxy 类。
要求：被代理类最少实现一个接口。

如何创建代理对象：使用Proxy类中的newProxyInstance方法

newProxyInstance方法的参数：

- ClassLoader：类加载器，它是用于加载代理对象字节码的。和被代理对象使用相同的类加载器。固定写法。
- Class[]：字节码数组，它是用于让代理对象和被代理对象有相同方法。固定写法。
- InvocationHandler：用于提供增强的代码。我们一般写的都是该接口的子接口实现类：InvocationHandler。它是让我们写如何代理。我们一般都是些一个该接口的实现类，通常情况下都是匿名内部类，但不是必须的。

**基于子类的动态代理：**

提供者：第三方的 CGLib，如果报 asmxxxx 异常，需要导入 asm.jar。
要求：被代理类不能用 final 修饰的类（最终类）。

如何创建代理对象：使用Enhancer类中的create方法

create方法的参数：

- Class：字节码 ，它是用于指定被代理对象的字节码。
- Callback：用于提供增强的代码。我们一般写的都是该接口的子接口实现类：MethodInterceptor。它是让我们写如何代理。我们一般都是些一个该接口的实现类，通常情况下都是匿名内部类，但不是必须的。

### 使用 JDK 官方的 Proxy 类创建代理对象

我们模拟一个业务场景：生产厂家与销售代理，消费者不能直接在厂家消费，需要在销售代理那儿消费，消费代理悄悄收取20%提成。

对产品做要求的接口：

```java
/**
 * 对生产厂家要求的接口
 */
public interface IProducer {

    /**
     * 销售
     * @param money
     */
    public void saleProduct(float money);

    /**
     * 售后
     * @param money
     */
    public void afterService(float money);
}
```

生产产品的工厂：

```java
/**
 * 一个生产者
 */
public class Producer implements IProducer{

    /**
     * 销售
     * @param money
     */
    public void saleProduct(float money){
        System.out.println("销售产品，并拿到钱："+money);
    }

    /**
     * 售后
     * @param money
     */
    public void afterService(float money){
        System.out.println("提供售后服务，并拿到钱："+money);
    }
}
```

消费者消费：

```java
/**
 * 模拟一个消费者
 */
public class Client {

    public static void main(String[] args) {
        final Producer producer = new Producer();
		// 通过销售代理消费，我们这里使用匿名内部类方式创建代理。
        IProducer proxyProducer = (IProducer) Proxy.newProxyInstance(producer.getClass().getClassLoader(),
                producer.getClass().getInterfaces(),
                new InvocationHandler() {
                    /**
                     * 作用：执行被代理对象的任何接口方法都会经过该方法
                     * 方法参数的含义
                     * @param proxy   代理对象的引用
                     * @param method  当前执行的方法
                     * @param args    当前执行方法所需的参数
                     * @return        和被代理对象方法有相同的返回值
                     * @throws Throwable
                     */
                    @Override
                    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                        //提供增强的代码
                        Object returnValue = null;

                        //1.获取方法执行的参数
                        Float money = (Float)args[0];
                        //2.判断当前方法是不是销售
                        if("saleProduct".equals(method.getName())) {
                            returnValue = method.invoke(producer, money*0.8f);
                        }
                        return returnValue;
                    }
                });
        
        proxyProducer.saleProduct(10000f);
    }
}
```

### 使用 CGLib 的 Enhancer 类创建代理对象

我们还是使用刚刚上面的例子，只是这个不必须需要实现接口。

因为这个是第三方的，所以先导入jar包：

```xml
<dependencies>
    <dependency>
        <groupId>cglib</groupId>
        <artifactId>cglib</artifactId>
        <version>3.2.0</version>
    </dependency>
</dependencies>
```

生产者：

```java
/**
 * 一个生产者
 */
public class Producer {

    /**
     * 销售
     * @param money
     */
    public void saleProduct(float money){
        System.out.println("销售产品，并拿到钱："+money);
    }

    /**
     * 售后
     * @param money
     */
    public void afterService(float money){
        System.out.println("提供售后服务，并拿到钱："+money);
    }
}
```

消费者：

```java
/**
 * 模拟一个消费者
 */
public class Client {

    public static void main(String[] args) {
        final Producer producer = new Producer();
        Producer cglibProducer = (Producer)Enhancer.create(producer.getClass(), new MethodInterceptor() {
            /**
             * 执行被代理对象的任何方法都会经过该方法
             * @param proxy
             * @param method
             * @param args
             *    以上三个参数和基于接口的动态代理中invoke方法的参数是一样的
             * @param methodProxy ：当前执行方法的代理对象
             * @return
             * @throws Throwable
             */
            @Override
            public Object intercept(Object proxy, Method method, Object[] args, MethodProxy methodProxy) throws Throwable {
                //提供增强的代码
                Object returnValue = null;

                //1.获取方法执行的参数
                Float money = (Float)args[0];
                //2.判断当前方法是不是销售
                if("saleProduct".equals(method.getName())) {
                    returnValue = method.invoke(producer, money*0.8f);
                }
                return returnValue;
            }
        });
        cglibProducer.saleProduct(12000f);
    }
}
```

## AOP

**什么是 AOP?** <span id="aop"></span>

AOP：全称是 Aspect Oriented Programming 即：面向切面编程。简单的说它就是把我们程序重复的代码抽取出来，在需要执行的时候，使用动态代理的技术，在不修改源码的基础上，对我们的已有方法进行增强。<a style="color:red" href="#servie-proxy">上面的案例最终解决方案就是通过动态代理的方式实现了对业务层方法的事务管理，即AOP。</a>

**AOP 的作用及优势?** 

作用：在程序运行期间，不修改源码对已有方法进行增强。
优势：

- 减少重复代码
- 提高开发效率
- 维护方便

**AOP 的实现方式?** 使用动态代理技术。

## Spring AOP

spring 的aop，就是在Spring中通过配置的方式，实现AOP的功能。

### 相关术语

**Joinpoint(连接点):**  所谓连接点是指那些被拦截到的点。在 spring 中,这些点指的是方法,因为 spring 只支持方法类型的
连接点。

**Pointcut(切入点):**  所谓切入点是指我们要对哪些 Joinpoint 进行拦截的定义。

**Advice(通知/增强):**  所谓通知是指拦截到 Joinpoint 之后所要做的事情就是通知。通知的类型：前置通知,后置通知,异常通知,最终通知,环绕通知。

**Introduction(引介):**  引介是一种特殊的通知在不修改类代码的前提下, Introduction 可以在运行期为类动态地添加一些方
法或 Field。

**Target(目标对象):**  代理的目标对象。

**Weaving(织入):**  是指把增强应用到目标对象来创建新的代理对象的过程。spring 采用动态代理织入，而 AspectJ 采用编译期织入和类装载期织入。

**Proxy（代理）:**  一个类被 AOP 织入增强后，就产生一个结果代理类。
**Aspect(切面):**  是切入点和通知（引介）的结合。

### 学习 spring 中的 AOP 要明确的事

**a、开发阶段（我们做的）**
编写核心业务代码（开发主线）：大部分程序员来做，要求熟悉业务需求。
把公用代码抽取出来，制作成通知。（开发阶段最后再做）：AOP 编程人员来做。
在配置文件中，声明切入点与通知间的关系，即切面。：AOP 编程人员来做。
**b、运行阶段（Spring 框架完成的）**
Spring 框架监控切入点方法的执行。一旦监控到切入点方法被运行，使用代理机制，动态创建目标对
象的代理对象，根据通知类别，在代理对象的对应位置，将通知对应的功能织入，完成完整的代码逻辑运行。

### 关于代理的选择

在 spring 中，框架会根据目标类是否实现了接口来决定采用哪种动态代理的方式。

### Spring AOP的切入点表达式

切入点表达式：它用于匹配方法的执行，相当于匹配切入点。

关键字：execution(表达式)   

表达式语法：<span style="color:blue">execution</span>(<span style="color:gray">[访问修饰符]</span> <span style="color:#A52A2A">返回值类型</span> <span style="color:#000066">包名.类名.方法名</span>(<span style="color:#66ff66">参数</span>))

表达式写法说明：

- 标准的表达式写法：
  `public void com.yyc.service.impl.AccountServiceImpl.saveAccount()`
- 访问修饰符可以省略
  `void com.yyc.service.impl.AccountServiceImpl.saveAccount()`
- 返回值可以使用通配符，表示任意返回值
  `* com.yyc.service.impl.AccountServiceImpl.saveAccount()`
- 包名可以使用通配符，表示任意包。但是有几级包，就需要写几个`*.`
  `* *.*.*.*.AccountServiceImpl.saveAccount())`
- 包名可以使用`..`表示当前包及其子包
  `* *..AccountServiceImpl.saveAccount()`
- 类名和方法名都可以使用`*`来实现通配
  `* *..*.*()`
- 参数列表：
  可以直接写数据类型：
  基本类型直接写名称         `int`
  引用类型写`包名.类名`的方式   `java.lang.String`
  可以使用通配符表示任意类型，但是必须有参数
  可以使用`..`表示有无参数均可，有参数可以是任意类型
- 全通配写法：
  `* *..*.*(..)`

- 实际开发中切入点表达式的通常写法：
  切到业务层实现类下的所有方法：
  `* com.yyc.service.impl.*.*(..)`

### Spring AOP的几种通知类型和基本使用方式

上面有说到Spring AOP通知的类型：前置通知，后置通知，异常通知，最终通知和环绕通知五种。下面简单演示记录配置。

一、需要引入aspectjweaver包，pom.xml文件如下：

```xml
    <dependencies>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>
            <version>5.0.2.RELEASE</version>
        </dependency>

        <dependency>
            <groupId>org.aspectj</groupId>
            <artifactId>aspectjweaver</artifactId>
            <version>1.8.7</version>
        </dependency>
    </dependencies>
```

二、模拟业务层，写业务接口和业务实现类：

```java
/**
 * 账户的业务层接口
 */
public interface IAccountService {

    /**
     * 模拟保存账户
     */
   void saveAccount();

    /**
     * 模拟更新账户
     * @param i
     */
   void updateAccount(int i);

    /**
     * 删除账户
     * @return
     */
   int  deleteAccount();
}
```

```java
/**
 * 账户的业务层实现类
 */
public class AccountServiceImpl implements IAccountService{

    @Override
    public void saveAccount() {
        System.out.println("执行了保存");
//        int i=1/0;
    }

    @Override
    public void updateAccount(int i) {
        System.out.println("执行了更新"+i);

    }

    @Override
    public int deleteAccount() {
        System.out.println("执行了删除");
        return 0;
    }
}
```

三、提取公共代码，即通知方法

```java
/**
 * 用于记录日志的工具类，它里面提供了公共的代码
 */
public class Logger {

    /**
     * 前置通知
     */
    public  void beforePrintLog(){
        System.out.println("前置通知Logger类中的beforePrintLog方法开始记录日志了。。。");
    }

    /**
     * 后置通知
     */
    public  void afterReturningPrintLog(){
        System.out.println("后置通知Logger类中的afterReturningPrintLog方法开始记录日志了。。。");
    }
    /**
     * 异常通知
     */
    public  void afterThrowingPrintLog(){
        System.out.println("异常通知Logger类中的afterThrowingPrintLog方法开始记录日志了。。。");
    }

    /**
     * 最终通知
     */
    public  void afterPrintLog(){
        System.out.println("最终通知Logger类中的afterPrintLog方法开始记录日志了。。。");
    }

    /**
     * 环绕通知
     * 问题：
     *      当我们配置了环绕通知之后，切入点方法没有执行，而通知方法执行了。
     * 分析：
     *      通过对比动态代理中的环绕通知代码，发现动态代理的环绕通知有明确的切入点方法调用，而我们的代码中没有。
     * 解决：
     *      Spring框架为我们提供了一个接口：ProceedingJoinPoint。该接口有一个方法proceed()，此方法就相当于明确调用切入点方法。
     *      该接口可以作为环绕通知的方法参数，在程序执行时，spring框架会为我们提供该接口的实现类供我们使用。
     *
     * spring中的环绕通知：
     *      它是spring框架为我们提供的一种可以在代码中手动控制增强方法何时执行的方式。
     */
    public Object aroundPringLog(ProceedingJoinPoint pjp){
        Object rtValue = null;
        try{
            Object[] args = pjp.getArgs();//得到方法执行所需的参数

            System.out.println("Logger类中的aroundPringLog方法开始记录日志了。。。前置");

            rtValue = pjp.proceed(args);//明确调用业务层方法（切入点方法）

            System.out.println("Logger类中的aroundPringLog方法开始记录日志了。。。后置");

            return rtValue;
        }catch (Throwable t){
            System.out.println("Logger类中的aroundPringLog方法开始记录日志了。。。异常");
            throw new RuntimeException(t);
        }finally {
            System.out.println("Logger类中的aroundPringLog方法开始记录日志了。。。最终");
        }
    }
}
```

四、然后配置Spring配置文件bean.xml：注意需要引入aop的命名空间

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
        http://www.springframework.org/schema/beans/spring-beans.xsd
        http://www.springframework.org/schema/aop
        http://www.springframework.org/schema/aop/spring-aop.xsd">

    <!-- 配置srping的Ioc,把service对象配置进来-->
    <bean id="accountService" class="com.yyc.service.impl.AccountServiceImpl"></bean>


    <!-- 配置Logger类 -->
    <bean id="logger" class="com.yyc.utils.Logger"></bean>

    <!--配置AOP-->
    <aop:config>
        <!-- 配置切入点表达式 id属性用于指定表达式的唯一标识。expression属性用于指定表达式内容
              此标签写在aop:aspect标签内部只能当前切面使用。
              它还可以写在aop:aspect外面，此时就变成了所有切面可用
          -->
        <aop:pointcut id="pt1" expression="execution(* com.yyc.service.impl.*.*(..))"></aop:pointcut>
        <!--配置切面 -->
        <aop:aspect id="logAdvice" ref="logger">
            <!-- 配置前置通知：在切入点方法执行之前执行
            <aop:before method="beforePrintLog" pointcut-ref="pt1" ></aop:before>-->

            <!-- 配置后置通知：在切入点方法正常执行之后值。它和异常通知永远只能执行一个
            <aop:after-returning method="afterReturningPrintLog" pointcut-ref="pt1"></aop:after-returning>-->

            <!-- 配置异常通知：在切入点方法执行产生异常之后执行。它和后置通知永远只能执行一个
            <aop:after-throwing method="afterThrowingPrintLog" pointcut-ref="pt1"></aop:after-throwing>-->

            <!-- 配置最终通知：无论切入点方法是否正常执行它都会在其后面执行
            <aop:after method="afterPrintLog" pointcut-ref="pt1"></aop:after>-->

            <!-- 配置环绕通知 详细的注释请看Logger类中-->
            <aop:around method="aroundPringLog" pointcut-ref="pt1"></aop:around>
        </aop:aspect>
    </aop:config>

</beans>
```

五、最后简单的测试

```java
public class AOPTest {

    public static void main(String[] args) {
        //1.获取容器
        ApplicationContext ac = new ClassPathXmlApplicationContext("bean.xml");
        //2.获取对象
        IAccountService as = (IAccountService)ac.getBean("accountService");
        //3.执行方法
        as.saveAccount();
    }
}
```



## *参考*

1. 重学Spring参考黑马57期Spring部分内容
2. 总结我之前在[博客园](https://www.cnblogs.com/hyyq/)初学Spring的系列文章，本篇总结得更好、更完整、更易懂、理解更深入。