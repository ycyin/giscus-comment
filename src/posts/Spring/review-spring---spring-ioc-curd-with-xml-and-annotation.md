---
title: 重温Spring---Spring IOC基于XML和注解的配置和比较
date: 2021-07-02 14:12:17
tags:
  - Spring
  - IOC
  - Spring IOC
  - Annotation
  - Junit
categories: Spring
---

## 前言

继上篇[重温Spring---使用Spring IOC解决程序耦合 | 敲代码的小松鼠 (ladybug.top)](https://ladybug.top/Spring/review-spring---spring-ioc)，学习了使用Spring IOC，均是采用XML配置文件形式配置的Bean及Bean的注入。本篇会基于XML和注解的方式分别实现一个CRUD，可以通过本篇文章了解XML和注解的方式使用及其异同，同时还可以了解到在Spring中使用Junit的方法。

## 注解配置Bean

在分别使用基于XML和注解的方式实现CRUD之前，我们先来学习一下使用注解方式配置Spring IOC的常用注解。

上篇使用XML配置了Bean，也详细了解了XML配置IOC的方法，现在用注解配置一下。

首先，使用注解配置Bean的常用注解：

### 用于创建对象的注解

作用就和在XML配置文件中编写一个`<bean>`标签实现的功能是一样的。

`<bean id="" class="">`

- `@Component`：
   作用：用于把当前类对象存入spring容器中
   属性：
      value：用于指定bean的id。当我们不写时，它的默认值是当前类名，且首字母改小写。
   
- `@Controller`：一般用在表现层

- `@Service`：一般用在业务层

- `@Repository`：一般用在持久层
  以上三个注解他们的作用和属性与Component是一模一样。他们三个是spring框架为我们提供明确的三层使用的注解，使我们的三层对象更加清晰

### 用于注入数据的注解

 作用就和在xml配置文件中的bean标签中写一个`<property>`标签的作用是一样的，集合类型的注入只能通过XML来实现。

`<property name="" ref="">`

`<property name="" value="">`

- `@Autowired`:
作用：自动按照类型注入。只要容器中有唯一的一个bean对象类型和要注入的变量类型匹配，就可以注入成功
如果ioc容器中没有任何bean的类型和要注入的变量类型匹配，则报错。
如果Ioc容器中有多个类型匹配时：使用要注入的对象变量名称作为 bean 的 id，在 spring 容器查找，找到了也可以注入成功
出现位置：可以是变量上，也可以是方法上
细节：在使用注解注入时，set方法就不是必须的了。
- `@Qualifier`:
 作用：在按照类中注入的基础之上再按照名称注入。它在给类成员注入时不能单独使用。但是在给方法参数（方法参数是Bean）注入时可以
   属性：
  value：用于指定注入bean的id。
- `@Resource`:
作用：直接按照bean的id注入。它可以独立使用
属性：
name：用于指定bean的id。
以上三个注入都只能注入其他bean类型的数据，而基本类型和String类型无法使用上述注解实现。
- `@Value`:
  作用：用于注入基本类型和String类型的数据
  属性：
  value：用于指定数据的值。它可以使用spring中SpEL(也就是spring的el表达式）SpEL的写法：${表达式}

### 用于改变作用范围的注解

他们的作用就和在xml配置文件中的`<bean>`标签中使用scope属性实现的功能是一样的。

`<bean id="" class="" scope="">`

- `@Scope`:

  作用：用于指定bean的作用范围

  属性：

  value：指定范围的取值。取值：<span style="color:blue">singleton  prototype</span> request session globalsession

### 用于和生命周期相关的注解 （了解）

他们的作用就和在`<bean>`标签中使用init-method和destroy-methode的作用是一样的。

`<bean id="" class="" init-method="" destroy-method="" />`

- `@PreDestroy`：

  作用：用于指定销毁方法。放在销毁方法上

- `@PostConstruct`：

  作用：用于指定初始化方法。放在初始化方法上

### 注解配置Bean示例

**XML配置包扫描：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
        http://www.springframework.org/schema/beans/spring-beans.xsd
        http://www.springframework.org/schema/context
        http://www.springframework.org/schema/context/spring-context.xsd">

    <!--告知spring在创建容器时要扫描的包，配置所需要的标签不是在beans的约束中，而是一个名称为
    context名称空间和约束中-->
    <context:component-scan base-package="com.yyc"></context:component-scan>
</beans>
```

**Java代码中使用注解配置Bean：**

```java
/****************DAO**************/

@Repository("accountDao2")
public class AccountDaoImpl2  implements IAccountDao {

    public  void saveAccount(){

        System.out.println("保存了账户2222222222222");
    }
}


/****************Service**************/
@Service("accountService")
//@Scope("prototype")
public class AccountServiceImpl implements IAccountService {

//    @Autowired
//    @Qualifier("accountDao1")
    @Resource(name = "accountDao2")
    private IAccountDao accountDao = null;

    @PostConstruct
    public void  init(){
        System.out.println("初始化方法执行了");
    }

    @PreDestroy
    public void  destroy(){
        System.out.println("销毁方法执行了");
    }

    public void  saveAccount(){
        accountDao.saveAccount();
    }
}
```

## 数据库安装与数据准备

数据库安装专门写了一篇：[在Windows10中安装MySQL5.7 Zip版本及常用配置 | 敲代码的小松鼠 (ladybug.top)](https://ladybug.top/软件安装&配置/install-MySQL5.7-zip-in-windows10.html)

**数据准备：**

```sql
CREATE TABLE ACCOUNT
(
    ID    int PRIMARY KEY AUTO_INCREMENT,
    NAME  varchar(40),
    MONEY float
) CHARACTER SET UTF8
  COLLATE UTF8_GENERAL_CI;

INSERT INTO ACCOUNT(NAME, MONEY) VALUES ('aaa', 1000);

INSERT INTO ACCOUNT(NAME, MONEY) VALUES ('bbb', 1000);

INSERT INTO ACCOUNT(NAME, MONEY) VALUES ('ccc', 1000);
```

**pom.xml文件引入包：**

这里使用dbutils作为数据库操作工具，使用c3p0作为数据库连接池，我们会使用到Junit进行测试，所以还需要引入spring-test和Junit包，通过IDEA查看引入的包还可以发现maven为我们自动引入了Spring-aop的包。如下：

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

## 使用基于XML配置IOC的方式实现CRUD

下面通过xml配置的方式来实现操作数据库

**实体类：** 对应数据库字段，方便我们将数据转换为对象

```java
public class Account implements Serializable {

    private Integer id;
    private String name;
    private Float money;

    // 省略getter、setter和toString方法
}
```

**持久层实现类：** 比较简单的通过dbutils工具操作数据库，由于接口中只是定义了方法，篇幅有限就不贴接口了。

```java
public class AccountDaoImpl implements IAccountDao {

    private QueryRunner runner;

    public void setRunner(QueryRunner runner) {
        this.runner = runner;
    }

    @Override
    public List<Account> findAllAccount() {
        try{
            return runner.query("select * from account",new BeanListHandler<Account>(Account.class));
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public Account findAccountById(Integer accountId) {
        try{
            return runner.query("select * from account where id = ? ",new BeanHandler<Account>(Account.class),accountId);
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void saveAccount(Account account) {
        try{
            runner.update("insert into account(name,money)values(?,?)",account.getName(),account.getMoney());
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void updateAccount(Account account) {
        try{
            runner.update("update account set name=?,money=? where id=?",account.getName(),account.getMoney(),account.getId());
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void deleteAccount(Integer accountId) {
        try{
            runner.update("delete from account where id=?",accountId);
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
```

**业务层实现类：** 由于我们这里没有什么逻辑，所以里面的方法直接调用DAO层方法即可。同样省略接口的定义。

```java
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
}
```

**bean.xml配置：** 使用XML配置IOC，包括我们Bean的配置和注入以及数据库相关的配置。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
        http://www.springframework.org/schema/beans/spring-beans.xsd">
    <!-- 配置Service -->
    <bean id="accountService" class="com.yyc.service.impl.AccountServiceImpl">
        <!-- 注入dao -->
        <property name="accountDao" ref="accountDao"></property>
    </bean>

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
</beans>
```

**Junit测试：** 这里直接使用Junit测试，后面的[附录](#spring-junit)会简单介绍Spring和Junit如何整合的。使用`@RunWith `注解替换原有运行器，使用`@ContextConfiguration `指定 spring 配置文件的位置。代码如下：

```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(locations = "classpath:bean.xml")
public class AccountServiceTest {

    @Autowired
    private  IAccountService as;

    @Test
    public void testFindAll() {
        List<Account> accounts = as.findAllAccount();
        for(Account account : accounts){
            System.out.println(account);
        }
    }

    @Test
    public void testFindOne() {
        Account account = as.findAccountById(1);
        System.out.println(account);
    }

    @Test
    public void testSave() {
        Account account = new Account();
        account.setName("test");
        account.setMoney(12345f);
        as.saveAccount(account);

    }

    @Test
    public void testUpdate() {
        Account account = as.findAccountById(4);
        account.setMoney(23456f);
        as.updateAccount(account);
    }

    @Test
    public void testDelete() {
        as.deleteAccount(4);
    }
}
```

## 使用基于注解配置IOC的方式实现CRUD

下面通过注解配置的方式来实现操作数据库

实体类保持不变，我们不用改变

**持久层实现类：** 我们通过注解将Dao对象放入Spring容器、使用注解注入dbutils操作对象。

```java
@Repository("accountDao")
public class AccountDaoImpl implements IAccountDao {

    @Autowired
    private QueryRunner runner;



    @Override
    public List<Account> findAllAccount() {
        try{
            return runner.query("select * from account",new BeanListHandler<Account>(Account.class));
        }catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // 其它同上节中的代码不变，这里省略
}
```

**业务层实现类：** 我们通过注解将Service对象放入Spring容器、使用注解注入dao层对象。

```java
@Service("accountService")
public class AccountServiceImpl implements IAccountService{

    @Autowired
    private IAccountDao accountDao;

    @Override
    public List<Account> findAllAccount() {
        return accountDao.findAllAccount();
    }

    // 同上、省略
}
```

**bean.xml配置：** 就目前来说，我们还是需要一个配置文件，首先因为我们使用了注解Spring不知道啊，我们要配置让它扫描注解，其次，我们的数据操作对象（即dbutils操作对象QueryRunner）现在还是处于Spring外部的jar包，还是需要xml文件配置它们。如下，很明显使用了注解配置Bean，xml文件就没有那么臃肿了。后面我们会说如何使用纯注解配置。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
        http://www.springframework.org/schema/beans/spring-beans.xsd
        http://www.springframework.org/schema/context
        http://www.springframework.org/schema/context/spring-context.xsd">

    <!-- 告知spring在创建容器时要扫描的包 -->
    <context:component-scan base-package="com.yyc"></context:component-scan>
    <!--配置QueryRunner-->
    <bean id="runner" class="org.apache.commons.dbutils.QueryRunner" scope="prototype">
        <!--注入数据源-->
        <constructor-arg name="ds" ref="dataSource"></constructor-arg>
    </bean>

    <!-- 配置数据源 -->
    <bean id="dataSource" class="com.mchange.v2.c3p0.ComboPooledDataSource">
        <!--连接数据库的必备信息-->
        <property name="driverClass" value="com.mysql.jdbc.Driver"></property>
        <property name="jdbcUrl" value="jdbc:mysql://localhost:3306/eesy"></property>
        <property name="user" value="root"></property>
        <property name="password" value="1234"></property>
    </bean>
</beans>
```

使用Junit的进行测试的代码和上一节的一样。

## 使用纯注解配置

在上面我们通过使用基于注解配置IOC的方式实现CRUD，后来发现依然离不开spring的xml配置文件。当然我们是可以通过配置来改造不写这个 bean.xml文件的。一起来看看吧！

### 需要改造的点

1. 我们使用注解配置IOC中的xml有下面这一句，我们需要消除它！
      ```xml
       <!-- 告知spring框架在，读取配置文件，创建容器时，扫描注解，依据注解创建对象，并存入容器中 -->
       <context:component-scan base-package="com.yyc"></context:component-scan>
      ```

 2. 我们关于操作数据库和数据库的相关配置，我们需要消除它！

      ```xml
      <!--配置QueryRunner-->
          <bean id="runner" class="org.apache.commons.dbutils.QueryRunner" scope="prototype">
              <!--注入数据源-->
              <constructor-arg name="ds" ref="dataSource"></constructor-arg>
          </bean>
      
          <!-- 配置数据源 -->
          <bean id="dataSource" class="com.mchange.v2.c3p0.ComboPooledDataSource">
              <!--连接数据库的必备信息-->
              <property name="driverClass" value="com.mysql.jdbc.Driver"></property>
              <property name="jdbcUrl" value="jdbc:mysql://localhost:3306/eesy"></property>
              <property name="user" value="root"></property>
              <property name="password" value="1234"></property>
          </bean>
      ```

### `@Configuration`、`@ComponentScan`等注解的使用

我们可以通过`@Configuration`、`@ComponentScan`、`@Bean`等注解的使用来彻底消除xml配置文件。

- `@Configuration`：

  作用：用于指定当前类是一个 spring 配置类，当创建容器时会从该类上加载注解。获取容器时需要使用AnnotationConfigApplicationContext(有`@Configuration` 注解的类.class)，当配置类作为AnnotationConfigApplicationContext对象创建的参数时，该注解可以不写。
  
  属性：
  
  value：用于指定配置类的字节码
  
- `@ComponentScan`：

  作用：用于指定 spring 在初始化容器时要扫描的包。作用和在 spring 的 xml 配置文件中的：`<context:component-scan base-package="com.yyc"/>`是一样的。
  
  属性：
  basePackages：用于指定要扫描的包。和该注解中的 value 属性作用一样。
  
- `@Bean`：

  作用：该注解只能写在方法上，表明把当前方法的返回值作为bean对象存入spring的ioc容器中

  属性：

  name：给当前`@Bean`注解方法创建的对象指定一个名称，即bean的id。当不写时，默认值是当前方法的名称

- `@PropertySource`：

  作用：用于加载.properties 文件中的配置。例如我们配置数据源时，可以把连接数据库的信息写到properties 配置文件中，就可以使用此注解指定 properties 配置文件的位置。

  属性：

  value[]：用于指定 properties 文件位置，可以有多个。如果是在类路径下，需要写上 classpath:

- `@Import`：

  作用：用于导入其他配置类，在引入其他配置类时，可以不用再写`@Configuration` 注解。当然，写上也没问
  题。当我们使用Import的注解之后，有Import注解的类就父配置类，而导入的都是子配置类

  属性：

  value[]：用于指定其他配置类的字节码。

### 纯注解配置

首先，因为我们没有了bean.xml，所以我们要将数据源的配置信息写到配置类中。

<span style="color:red;font-size:1.5em">注意：数据库jdbcConfig.properties配置文件放到resources目录下、配置类放到需要扫描的包的上一层</span>

**jdbcConfig.properties：**

```properties
jdbc.driver=com.mysql.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/ycyin
jdbc.username=root
jdbc.password=1234
```

**JdbcConfig子配置类：** 用于将properties文件中的配置读取以及数据源的配置

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

    @Bean(name="ds1")
    public DataSource createDataSource1(){
        try {
            ComboPooledDataSource ds = new ComboPooledDataSource();
            ds.setDriverClass(driver);
            ds.setJdbcUrl("jdbc:mysql://localhost:3306/ycyin");
            ds.setUser(username);
            ds.setPassword(password);
            return ds;
        }catch (Exception e){
            throw new RuntimeException(e);
        }
    }
}
```

**父配置类：** 数据源配置好了，我们如何将它与Spring关联起来呢？使用`@Import`注解导入父配置类，同时配置好包扫描等。

```java
@Configuration
@ComponentScan("com.yyc")
@Import(JdbcConfig.class)
@PropertySource("classpath:jdbcConfig.properties")
public class SpringConfiguration {

}
```

这时我们就可以删除bean.xml文件了，实现纯注解配置了。

**Junit测试**：

这时使用Junit进行测试即可，[附录：Spring整合Junit](#spring-junit)，代码如下：

```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(classes = SpringConfiguration.class)
public class AccountServiceTest {

    @Autowired
    private IAccountService as = null;

    @Test
    public void testFindAll() {
        //执行方法
        List<Account> accounts = as.findAllAccount();
        for(Account account : accounts){
            System.out.println(account);
        }
    }

    // 省略
}
```



## 关于Spring注解和XML配置的选择问题

**注解的优势：**
  配置简单，维护方便（我们找到类，就相当于找到了对应的配置）。
**XML 的优势：**
  修改时，不用改源码。不涉及重新编译和部署。
**Spring 管理 Bean 方式的比较：**

|                    | 基于XML配置                                                  | 基于注解配置                                                 |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Bean定义           | `<bean id="" class="">`                                      | `@Component`及其衍生注解`@Controller`、`@Service`、`@Repository` |
| Bean名称           | 通过id或name指定                                             | `@Component("person")`                                       |
| Bean注入           | `<property>`或者p名称空间                                    | `@Autowired` 按类型注入<br />`@Qualifier`按名称注入          |
| 生命周期及作用范围 | init-method指定初始化方法<br />destroy-method指定销毁方法<br />范围 scope属性 | `@PostConstruct`初始化<br/>`@PreDestroy`销毁<br/>`@Scope`设置作用范围 |
| 适用场景           | Bean来自第三方，适用其它jar中的Bean                          | Bean的实现类由用户自己方                                     |

## *附：*Spring 整合 Junit

<span id="spring-junit"></span>在我们还没有将Spring与Junit整合之前，我们使用main方法或没有整合Spring的Junit进行测试，我们必须手动去创建容器并获取Bean。

当使用xml配置时：

```java
ApplicationContext ac = new ClassPathXmlApplicationContext("bean.xml");
IAccountService as = ac.getBean("accountService",IAccountService.class);
```

当使用注解配置时：

```java
ApplicationContext ac = new AnnotationConfigApplicationContext(SpringConfiguration.class);
IAccountService as = ac.getBean("accountService",IAccountService.class);
```

针对上述问题，我们需要的是程序能自动帮我们创建容器。一旦程序能自动为我们创建 spring 容器，我们就无须手动创建了，问题也就解决了。
我们都知道，Junit自己都无法知晓我们是否使用了 spring 框架，更不用说帮我们创建 spring 容器了。不过好在，junit 给我们暴露
了一个注解，可以让我们替换掉它的运行器。
这时，我们需要依靠 spring 框架，因为它提供了一个运行器，可以读取配置文件（或注解）来创建容器。我们只需要告诉它配置文件在哪就行了。

**1.导入Jar**

需要Junit、spring-test、spring-aop三个jar包，如果使用Maven的话，只需要导入前面两个，aop包maven会帮我们自动导入。

**2.使用`@RunWith `注解替换原有运行器**

使用Spring提供的运行器。`@RunWith(SpringJUnit4ClassRunner.class)`

**3.使用`@ContextConfiguration` 指定 spring 配置文件的位置**

作用是告知spring的运行器，spring和ioc创建是基于xml还是注解的，并且说明位置

`@ContextConfiguration`

 *                  locations：指定xml文件的位置，加上classpath关键字，表示在类路径下
 *                  classes：指定注解类所在地位置

比如：`@ContextConfiguration(locations= {"classpath:bean.xml"})`或`@ContextConfiguration(classes = SpringConfiguration.class)`

**4.使用`@Autowired`给测试类中的变量注入数据**

**5.样例**

```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(classes = SpringConfiguration.class)
public class AccountServiceTest {

    @Autowired
    private IAccountService as = null;

    @Test
    public void testFindAll() {
        // 操作
    }
}
```



## *参考*

1. 重学Spring参考黑马57期Spring部分内容
2. 总结我之前在[博客园](https://www.cnblogs.com/hyyq/)初学Spring的系列文章，本篇总结得更好、更完整、更易懂、理解更深入。