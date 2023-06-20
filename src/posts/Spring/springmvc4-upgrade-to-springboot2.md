---
title: SpringMVC4升级为SpringBoot2实战
date: 2022-06-07 15:42:44
tag:
  - Spring
  - SpringMVC
  - Spring Boot
category: Spring
description: SpringMVC升级为SpringBoot实战
---

## 前言

SpringMVC4升级为SpringBoot2.6.7，根据SpringBoot的最小配置原则，其升级主要就是将xml的配置方式改为配置文件、Bean配置或者不配置。

该项目原先为一个Spring4+SpringMVC4+JPA+Ehcache配置的Maven多模块项目，打包后使用War包部署，为了不做太大的改动，仅在原先项目上修改，修改后仍然是一个Maven多模块项目，采用SpringBoot方式运行项目部署也只需要部署Jar包。

## 项目根pom.xml文件处理

### 相关依赖处理

1.项目根路径下添加`spring-boot-starter-parent`:

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.6.7</version>
    <relativePath/> <!-- lookup parent from repository -->
</parent>
```

2.添加必要的dependency：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter</artifactId>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
    <version>2.6.6</version>
</dependency>
```

3.删除不需要的依赖包，比如：Spring相关：`spring-web`，`spring-webmvc`，`spring-core`，`spring-beans`，`spring-context`等、Hibernate相关：`hibernate-core`，`hibernate-ehcache`等SpringBoot的多个Starter会自动依赖的jar。

### 移除多profiles配置

移除多profiles配置，改为SpringBoot后直接在yaml配置文件中指定`spring.profiles.active`即可。

```xml
<profiles>
   <profile>
      <!-- 本地开发环境 -->
      <id>test</id>
      <properties>
         <profiles.active>test</profiles.active>
      </properties>
      <activation>
         <!-- 激活  -->
         <activeByDefault>true</activeByDefault>
      </activation>
   </profile>
   <profile>
      <!-- 生产环境 -->
      <id>product</id>
      <properties>
         <profiles.active>product</profiles.active>
      </properties>
   </profile>
</profiles>

<build>
    <!-- 省略其它配置 -->
    <resources>
        <resource>
            <directory>src/main/resources</directory>
            <!-- 资源根目录排除各环境的配置，防止在生成目录中多余其它目录 -->
            <excludes>
                <exclude>test/</exclude>
                <exclude>product/</exclude>
            </excludes>
        </resource>
        <resource>  
            <directory>src/main/resources/${profiles.active}</directory>
        </resource>
        <resource>
            <directory>src/main/java</directory>
            <includes>
                <include>**/*.hbm</include>
                <include>**/*.xml</include>
            </includes>
        </resource>
    </resources>
</build>
```

### 添加打包插件

在根pom.xml中添加打包插件，并指定SpringBoot的启动类路径mainClass

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <mainClass>com.xxx.Application</mainClass>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>repackage</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

## Web模块处理

### 相关依赖处理

1.修改打包方式为Jar

```xml
<packaging>jar</packaging> <!-- <packaging>war</packaging> -->
```

2.修改build插件为`spring-boot-maven-plugin`

```xml
<build>
    <finalName>XXX</finalName>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <!--
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
             -->
        </plugin>
    </plugins>
</build>
```

3.同根pom.xml中一样，移除多profiles配置

### 添加启动类

添加SpringBoot Main函数启动,一般将该类添加到其它类的父包中(否则可能SpringBoot自动扫描不到其它类)

```java
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {

    public static void main( String[] args )
    {
    	SpringApplication.run(Application.class, args);
    }

}
```

### 配置文件转化

将原先的`web.xml`（JaveWeb配置文件）、`applicationContext.xml`和`springmvc-servlet.xml`（Spring相关xml配置）中的配置转换为配置yaml文件、Java配置或者直接删除由SpringBoot自动完成。

最终会将webapp目录删除，包括`web.xml`、resources下的所有`applicationContext*.xml`等与Spring相关的xml配置文件都不需要了

如果有静态(前端页面文件)文件也由webapp移动到resources目录下，最终的resources目录结构树如下：

```
└── resources
    ├── 省略一些代码中会读取的配置文件
    ├── application-dev.yml
    ├── application-pro.yml
    ├── application.yml
    ├── logback.xml
    ├── pro
    │   ├── description.properties
    │   ├── ehcacheConfig.xml
    │   ├── liquibase
    │   └── staticRes.properties
    ├── dev
    │   ├── description.properties
    │   ├── ehcacheConfig.xml
    │   ├── liquibase
    │   └── staticRes.properties
    └── static
        ├── app
        ├── assets
        ├── custom
        ├── download
        ├── favicon.ico
        ├── footer.html
        ├── index.html
        ├── maps
        ├── scripts
        └── styles
```

#### Boot配置文件与静态文件

resources目录用于存放SpringBoot下的配置文件、静态资源等。并根据系统情况创建配置文件`application.yaml`、`application-dev.yaml`、`application-pro.yaml`

在`application-dev.yaml`和`application-pro.yaml`中分别配置测试和生产的配置，在`application.yaml`中使用`spring.profiles.active`或者打包时使用命令覆盖激活特定配置文件。

例如：在`application-dev.yaml`中的liquibase配置使用的是`classpath:/dev/`目录下的文件

```yaml
spring:
  liquibase:
    change-log: classpath:/dev/liquibase/master.xml
    database-change-log-table: xxx_CONFIG_BASELOG
    database-change-log-lock-table: xxx_CONFIG_BASELOGLOCK
```

在`application-pro.yaml`中的liquibase配置使用的是`classpath:/pro/`目录下的文件

```yaml
spring:
  liquibase:
    change-log: classpath:/dev/liquibase/master.xml
    database-change-log-table: xxx_CONFIG_BASELOG
    database-change-log-lock-table: xxx_CONFIG_BASELOGLOCK
```

在`application.yaml`中激活dev环境配置：

```yaml
spring:
  profiles:
    active:
    - dev
```

这在原先的配置中也是有的，位于web.xml中：

```xml
<context-param>
    <param-name>spring.profiles.active</param-name>
    <param-value>dev</param-value>
</context-param>
```

#### Servlet、Filter、Listener

号称JavaWeb三剑客的Servlet、Filter、Listener原先注册在web.xml中，Filter过滤器修改为使用注解实现、Servlet也修改为使用代码方式注册，而Listener原先只配置了spring提供的几个Listener（`org.springframework.web.context.ContextLoaderListener`，`org.springframework.web.util.IntrospectorCleanupListener`，`org.springframework.web.util.WebAppRootListener`），没有自定义可以不用再配置了。

**Servlet**：原先在web.xml中的配置如下

```xml
<servlet>
    <display-name>验证码</display-name>
    <servlet-name>catcha</servlet-name>
    <servlet-class>com.xxx.common.NewRandomServlet</servlet-class>
</servlet>
<servlet-mapping>
    <servlet-name>catcha</servlet-name>
    <url-pattern>/api/checkCode/get.html</url-pattern>
</servlet-mapping>
```

修改：

```java
@Configuration
public class ServletConfig {

    @Bean
    public ServletRegistrationBean myServletRegistrationBean(){
        ServletRegistrationBean servletRegistrationBean = new ServletRegistrationBean(new NewRandomServlet(),"/api/checkCode/get.html");
        return servletRegistrationBean;
    }
}
```

**Filter**：比如下面这个refererFilter，在web.xml中配置如下

```xml
<filter>
    <filter-name>refererFilter</filter-name>
    <filter-class>com.xxx.common.HttpRefererFilter</filter-class>
    <init-param>
        <param-name>domains</param-name>
        <param-value>省略</param-value>
    </init-param>
</filter>
```

原来的`com.xxx.common.HttpRefererFilter`类：

```java
public class HttpRefererFilter implements Filter {

	private String[] trustDomians;
	/**
	 *  参数
	 * @param filterConfig 参数
	 * @throws ServletException 参数
	 */
	@Override
	public void init(FilterConfig filterConfig) throws ServletException {
        
		String domains = filterConfig.getInitParameter("domains");
		trustDomians = StringUtils.split(domains,",");
		
	}
	// 省略
}
```

修改：只需要加上`@Component`注解，init-param则可以直接通过`@Value`注解从配置文件中加载，`@Order(3)`则根据该Filter在web.xml中的配置顺序指定。

```java
@Component
@Order(3)
public class HttpRefererFilter implements Filter {
   private String[] trustDomains;

   @Value("${httpRefererFilter.domainsConfig}")
   private String domainsConfig;

   @Override
   public void init(FilterConfig filterConfig) throws ServletException {
      trustDomains = StringUtils.split(domainsConfig,",");
   }
}
```

#### Interceptor与静态资源

拦截器和静态资源原先配置在SpringMVC的配置文件中，修改为使用注解+覆盖WebMvcConfigurer中方法实现。

原先的`springmvc-servlet.xml`文件中的配置

```xml
<mvc:resources location="/font/" mapping="/font/**" />
<mvc:resources location="/image/" mapping="/image/**" />
<mvc:resources location="/interface/" mapping="/interface/**" />
<mvc:resources location="/script/" mapping="/script/**" />
<mvc:resources location="/style/" mapping="/style/**" />
<!--太多，省略部分-->
<mvc:resources location="/" mapping="/favicon.ico"/>
<mvc:resources location="/" mapping="/footer.html"/>
<mvc:resources location="/" mapping="/index.html"/>

<mvc:interceptors>
    <!-- 输出日志ID拦截器 -->
    <mvc:interceptor>
        <mvc:mapping path="/**" />
        <mvc:exclude-mapping path="/tmpl/**" />
        <bean class="com.xxx.common.LogInterceptor" />
    </mvc:interceptor>
</mvc:interceptors>
```

修改为：为拦截器添加注解

```java
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class LogInterceptor implements HandlerInterceptor {
}
```

WebMVC配置，覆写WebMvcConfigurer中的addResourceHandlers方法进行静态资源配置，覆写addInterceptors方法注册拦截器：

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {


    @Autowired
    private LogInterceptor logInterceptor;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/download/**").addResourceLocations("classpath:/static/download/");
		// 省略
        registry.addResourceHandler("/maps/**").addResourceLocations("classpath:/static/maps/");
        registry.addResourceHandler("/scripts/**").addResourceLocations("classpath:/static/scripts/");
        registry.addResourceHandler("/style/**").addResourceLocations("classpath:/static/style/");
        registry.addResourceHandler("/index.html").addResourceLocations("classpath:/static/index.html");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(logInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/tmpl/**");
        // 多个直接addInterceptor多个
        // registry.addInterceptor(xxxInterceptor)
        //         .addPathPatterns("/**")
        //         .excludePathPatterns("/xxx/**","/yyy/**");         
    }
}
```

## 关于敏感数据加密

项目中用到的用户名密码等敏感信息，比如数据库、Redis的用户名密码通常是使用加密存储在配置文件中的，但是在设置到数据库连接、缓存连接时需要解密。比如原先项目中使用c3p0数据连接池连接数据库，则使用了如下方法：

```java
import org.springframework.beans.factory.FactoryBean;

import java.util.Properties;
public class PropertiesEncryptFactoryBean implements FactoryBean {

	private Properties properties;

    public Object getObject() throws Exception {  
        return getProperties();  
    }

    public Class getObjectType() {  
        return java.util.Properties.class;  
    }

    public boolean isSingleton() {  
        return true;  
    }  
  
    /**
     * 获取解密信息.
     *
     * @return the properties
     */
    public Properties getProperties() {  
        return properties;  
    }  
    
    /**
     * 对信息进行解密
     *
     * @param inProperties
     */
    public void setProperties(Properties inProperties) {  
        this.properties = inProperties;  
        String originalPassword = properties.getProperty("password");    
        if (originalPassword != null){
        	// 具体的解密方法，省略
        	String newPassword = 
            properties.put("password", newPassword);  
        }  
    }  
}

```

在`application-database.xml`文件中：

```xml
<beans profile="pro">
   <!-- dataSource -->
   <bean id= "dataSource" class ="com.mchange.v2.c3p0.ComboPooledDataSource"
            destroy-method="close" >
            <property name="properties" ref="dataSourceProperties"/>
            <property name="driverClass" value="${jdbc.driverClassName}" />
            <!-- 省略n个配置 -->
            <property name="preferredTestQuery" value="select 1 from dual" />
      </bean>
      <bean id="dataSourceProperties" class="com.xxx.common.utils.PropertiesEncryptFactoryBean">  
        <property name="properties">  
            <props>  
                <prop key="password">${jdbc.password}</prop>  
            </props>  
        </property>  
      </bean>  
</beans>
```

其它敏感信息也类似，这种方式在SpringBoot中不方便。

我们将其进行改造，使用一个第三方包：

```xml
<dependency>
    <groupId>com.github.ulisesbocchio</groupId>
    <artifactId>jasypt-spring-boot-starter</artifactId>
    <version>3.0.4</version>
</dependency>
```

解密类：

```java
import com.ulisesbocchio.jasyptspringboot.EncryptablePropertyResolver;

public class MyEncryptPropertyResolver implements EncryptablePropertyResolver {

    //自定义密文前缀
    public static final String ENCODED_PASSWORD_HINT = "PASS-";

    @Override
    public String resolvePropertyValue(String value) {
        if (null != value && isEncrypted(value)) {
            //对配置文件加密值进行解密。加解密方式可以自定义
            value = unwrapEncryptedValue(value);
            return XXX.decrypt(value);
        }
        return value;
    }


    /**
     * 判断是否是加密内容
     */
    public boolean isEncrypted(String property) {
        if (null != property) {
            return property.startsWith(ENCODED_PASSWORD_HINT);
        }
        return false;
    }

    /**
     * 去除前缀
     */
    public String unwrapEncryptedValue(String property) {
        return property.substring(ENCODED_PASSWORD_HINT.length());
    }

```

注册解密类：

```java
@Bean
public EncryptablePropertyResolver encryptablePropertyResolver() {
    return new MyEncryptPropertyResolver();
}
```

使用时只需要将密码加上在解密类中配置好的前缀到配置文件中即可。

```yaml
spring:
  datasource:
    password: PASS-9EKJH8L1KA8L3iaA
```

## 关于Redis缓存

原先的配置：

```xml
<?xml version="1.0" encoding="utf-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
	   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	   xsi:schemaLocation="http://www.springframework.org/schema/beans
	http://www.springframework.org/schema/beans/spring-beans-4.2.xsd">


  <bean id="cacheTemplate" class="com.xxx.common.cache.RedisCacheSupport">
	  <property name="stringRedisTemplate" ref="stringRedisTemplate" />
	  <property name="redisTemplate" ref="redisTemplate" />
    </bean>
	<!-- redisClient start -->
	<bean id="jedisPoolConfig" class="redis.clients.jedis.JedisPoolConfig" >
		<!--最大空闲数-->
		<property name="maxIdle" value="${redis.maxIdle}" />
		<!--连接池的最大数据库连接数  -->
		<property name="maxTotal" value="${redis.maxTotal}" />
		<!--最大建立连接等待时间-->
		<property name="maxWaitMillis" value="${redis.maxWaitMillis}" />
		<!--逐出连接的最小空闲时间 默认1800000毫秒(30分钟)-->
		<property name="minEvictableIdleTimeMillis" value="${redis.minEvictableIdleTimeMillis}" />
		<!--每次逐出检查时 逐出的最大数目 如果为负数就是 : 1/abs(n), 默认3-->
		<property name="numTestsPerEvictionRun" value="${redis.numTestsPerEvictionRun}" />
		<!--逐出扫描的时间间隔(毫秒) 如果为负数,则不运行逐出线程, 默认-1-->
		<property name="timeBetweenEvictionRunsMillis" value="${redis.timeBetweenEvictionRunsMillis}" />
		<!--是否在从池中取出连接前进行检验,如果检验失败,则从池中去除连接并尝试取出另一个-->
		<property name="testOnBorrow" value="true" />
		<!--在空闲时检查有效性, 默认false  -->
		<property name="testWhileIdle" value="true" />
	</bean >

	<!-- redis集群配置 哨兵模式 -->
	<bean id="sentinelConfiguration" class="org.springframework.data.redis.connection.RedisSentinelConfiguration">
		<property name="master">
			<bean class="org.springframework.data.redis.connection.RedisNode">
				<!--  这个值要和Sentinel中指定的master的值一致，不然启动时找不到Sentinel会报错的   -->
				<property name="name" value="mymaster"></property>
				<!-- 配置注master节点
				<constructor-arg name="host" value="${redis.hostName}"/>
				<constructor-arg name="port" value="${redis.port}"/>
				-->
			</bean>
		</property>
		<!--  记住了,这里是指定Sentinel的IP和端口，不是Master和Slave的   -->
		<property name="sentinels">
			<set>
				<bean class="org.springframework.data.redis.connection.RedisNode">
					<constructor-arg name="host" value="${redis.sentinel.host}"></constructor-arg>
					<constructor-arg name="port" value="${redis.sentinel.port}"></constructor-arg>
				</bean>
				<bean class="org.springframework.data.redis.connection.RedisNode">
					<constructor-arg name="host" value="${redis.sentine2.host}"></constructor-arg>
					<constructor-arg name="port" value="${redis.sentine2.port}"></constructor-arg>
				</bean>
				<bean class="org.springframework.data.redis.connection.RedisNode">
					<constructor-arg name="host" value="${redis.sentine3.host}"></constructor-arg>
					<constructor-arg name="port" value="${redis.sentine3.port}"></constructor-arg>
				</bean>
			</set>
		</property>
	</bean>
	<bean id="jedisConnectionFactory" class="com.xxx.common.cache.JedisPasswdConnectionFactory">
        <!--JedisPasswdConnectionFactory  extends JedisConnectionFactory 处理密码解密的-->
		<constructor-arg name="sentinelConfig" ref="sentinelConfiguration"></constructor-arg>
		<constructor-arg name="poolConfig" ref="jedisPoolConfig"></constructor-arg>
		<property name="password" value="${redis.password}"></property>
	</bean>
	<!--redis操作模版,使用该对象可以操作redis  -->
	<bean id="redisTemplate" class="org.springframework.data.redis.core.RedisTemplate" >
		<property name="connectionFactory" ref="jedisConnectionFactory" />
		<!--如果不配置Serializer，那么存储的时候缺省使用String，如果用User类型存储，那么会提示错误User can't cast to String！！  -->
		<property name="keySerializer" >
			<bean class="org.springframework.data.redis.serializer.StringRedisSerializer" />
		</property>
		<property name="valueSerializer" >
			<bean class="com.xxx.common.cache.XXXRedisSerializer" />
		</property>
		<property name="hashKeySerializer">
			<bean class="org.springframework.data.redis.serializer.StringRedisSerializer"/>
		</property>
		<property name="hashValueSerializer">
			<bean class="com.xxx.common.cache.XXXRedisSerializer"/>
		</property>
		<!--开启事务  -->
		<property name="enableTransactionSupport" value="true"></property>
	</bean >

	<bean id="stringRedisTemplate" class="org.springframework.data.redis.core.StringRedisTemplate" >
		<property name="connectionFactory" ref="jedisConnectionFactory" />
	</bean>

</beans>
```

可以看到主要配置有cacheTemplate、redisTemplate、jedisPoolConfig、sentinelConfiguration、jedisConnectionFactory等，其中jedisPoolConfig、sentinelConfiguration、jedisConnectionFactory是关于Redis连接信息和JedisPool相关的，直接放到yaml配置文件中：

```yaml
spring:
  redis:
    password: PASS-GF8ADFJH6BHB1==
    jedis:
      pool:
        enabled: true
        max-active: 1000
        max-idle: 100
        testOnBorrow: true
        time-between-eviction-runs: 60000
        max-wait: 2000
    sentinel:
      master: mymaster
      nodes:
        - 111.111.11.1:26379
        - 111.111.11.1:26380
        - 111.111.11.1:26381
    client-type: jedis
```

cacheTemplate由之前的xml配置改为注解配置

```java
@Component("cacheTemplate")
public class RedisCacheSupport implements CacheTemplate {

   @Autowired
   private RedisTemplate<String, Object> redisTemplate;
   @Autowired
   private StringRedisTemplate stringRedisTemplate;
   // ...
}
```

redisTemplate由之前的xml配置改为`@Configuration`Bean注入

```java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisNode;
import org.springframework.data.redis.connection.RedisSentinelConfiguration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import redis.clients.jedis.JedisPoolConfig;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Configuration
public class RedisConfig {


    /**
     * 实例化 RedisTemplate 对象
     *
     * @return
     */
    @Bean
    public RedisTemplate<String, Object> functionDomainRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
        RedisTemplate<String, Object> redisTemplate = new RedisTemplate<>();
        //如果不配置Serializer，那么存储的时候缺省使用String，如果用User类型存储，那么会提示错误User can't cast to String！
        redisTemplate.setKeySerializer(new StringRedisSerializer());
        redisTemplate.setHashKeySerializer(new StringRedisSerializer());
        redisTemplate.setHashValueSerializer(new XXXRedisSerializer());
        redisTemplate.setValueSerializer(new XXXRedisSerializer());
        // 开启事务
        redisTemplate.setEnableTransactionSupport(true);
        redisTemplate.setConnectionFactory(redisConnectionFactory);
        redisTemplate.afterPropertiesSet();
        return redisTemplate;
    }
}
```

## 关于单元测试问题

```java
// Controller层的测试由
@WebAppConfiguration
@ContextConfiguration({"classpath*:/applicationContexts/applicationContext*.xml","classpath:springmvc-servlet.xml"})
@ActiveProfiles("test")
// 改为
@ActiveProfiles("test")
@RunWith(SpringRunner.class)
@SpringBootTest
```

发现单元测试不报错也不执行，是因为maven-surefire-plugin 不支持以前的 Test 注解了，需要依赖 junit-jupiter-api:5.7.0，使用里面的测试注解。[^1]

具体区别如下：

注释位于 `org.junit.jupiter.api` 包中。

断言位于 `org.junit.jupiter.api.Assertions` 类中。

假设位于 `org.junit.jupiter.api.Assumptions` 类中。

`@Before` 和 `@After` 不再存在；使用 `@BeforeEach` 和 `@AfterEach` 代替。

`@BeforeClass` 和 `@AfterClass` 不再存在；使用 `@BeforeAll` 并改为 `@AfterAll`。

`@Ignore` 不再存在；使用 `@Disabled` 或其他内置功能之一 执行条件代替

`@Category` 不再存在；改用 `@Tag`。

`@RunWith` 不再存在；被 `@ExtendWith` 取代。

`@Rule` 和 `@ClassRule` 不再存在；被 `@ExtendWith` 取代，并且 `@RegisterExtension`

## 配置监控暴露点

在SpringBoot中配置简单的监控暴露点[^4]，如果只需要监控JVM、接口调用时间等基本信息只需要做如下配置即可。

添加jar包：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

MicroMeter配置：

```java
import io.micrometer.core.aop.TimedAspect;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Collections;

@Configuration
public class MicroMeterConfig {

    @Bean
    public MeterRegistryCustomizer<MeterRegistry> meterRegistryCustomizer(@Value("${spring.application.name}") String applicationName) {
        return meterRegistry -> meterRegistry.config().commonTags(Collections.singletonList(Tag.of("application",
                applicationName)));
    }

    // Spring Boot中无法直接使用@Timed，需要引入TimedAspect切面支持。
    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }
}
```

Spring Boot 默认提供了一个`/actuator/promethues`端点用于服务指标数据拉取，端点暴露的数据中可能包含应用敏感数据，通过以下配置可以限制端点数据暴露（exclude 优先级高于 include 优先级）。

| Property                                    | Default  |
| ------------------------------------------- | -------- |
| `management.endpoints.jmx.exposure.exclude` |          |
| `management.endpoints.jmx.exposure.include` | `*`      |
| `management.endpoints.web.exposure.exclude` |          |
| `management.endpoints.web.exposure.include` | `health` |

启动服务，访问`http://localhost:8800/actuator/prometheus`可以看到服务指标数据

## 疑难解决

### 1.restful接口后缀为.html无法访问

由于历史原因，该项目中的restful接口有的不带后缀，有的后缀名是`.html`，与静态资源`.html`冲突，导致访问restful接口时会被识别去寻找html静态资源导致404。

在之前的SpringMVC中只需要在web.xml中指定DispatcherServlet的url-pattern为`*.html`匹配restful接口后缀名是`.html`的情况

```xml
<servlet>
   <servlet-name>springmvc</servlet-name>
   <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
   <init-param>
      <param-name>contextConfigLocation</param-name>
      <param-value>classpath*:/springmvc-servlet.xml</param-value>
   </init-param>
   <load-on-startup>1</load-on-startup>
</servlet>
<servlet-mapping>
   <servlet-name>springmvc</servlet-name>
   <url-pattern>*.html</url-pattern>
</servlet-mapping>
```

`springmvc-servlet.xml`中配置了所有的`mvc:resources`资源匹配静态资源html、css、js等

```xml
<mvc:resources location="/script/" mapping="/script/**" />
<mvc:resources location="/style/" mapping="/style/**" />
<!--省略-->
```

修改为SpringBoot后：`ServletRegistrationBean`需要加上`"*.html","/*"`这两个UrlMapping，如果不加`"/*"`就会出现访问不到html资源。

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    /**
     * -设置url后缀模式匹配规则
     * -该设置匹配所有的后缀
     */
    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        //设置是否是后缀模式匹配,即:/test.*
        configurer.setUseSuffixPatternMatch(true)
                //设置是否自动后缀路径模式匹配,即：/test/
                .setUseTrailingSlashMatch(true);
    }

    /**
     * -该设置指定匹配后缀;
     *
     * @param dispatcherServlet servlet调度器
     * @return ServletRegistrationBean
     */
    @Bean
    public ServletRegistrationBean servletRegistrationBean(DispatcherServlet dispatcherServlet) {
        ServletRegistrationBean servletServletRegistrationBean = new ServletRegistrationBean(dispatcherServlet);
        //指定后缀，可替换其他后缀
        servletServletRegistrationBean.addUrlMappings("*.html","/*");// 这里必须加上/*

        return servletServletRegistrationBean;
    }
}
```

### 2.文件上传与下载问题

项目中提供有Excel模板下载功能，还有文件导入功能，涉及文件上传下载，升级SpringBoot后无法使用。

关于模板文件下载，升级项目之前模板文件是放在项目webapp中的，项目打包为war包，代码中可以直接`new File(path)`读取然后直接获取输入流，现在SpringBoot的Jar包中使用这种方式无法读取。

```java
// 原来的
File downLoadFile = new File(path);
InputStream fis = new FileInputStream(downLoadFile);
// 需要修改为读取Resource
PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
Resource res = resolver.getResource(path);
InputStream fis = res.getInputStream();
```

在项目中一些读取配置文件预加载的地方也要进行修改

```java
Resource res = new ClassPathResource("6000.txt");
// 改为
PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
Resource res = resolver.getResource("6000.txt");
```

对于文件上传，SpringMVC中需要配置MultipartResolver处理器

```xml
<!-- SpringMVC上传文件时，需要配置MultipartResolver处理器 -->
<bean id="multipartResolver"
   class="org.springframework.web.multipart.commons.CommonsMultipartResolver">
   <property name="defaultEncoding" value="UTF-8" />
   <!-- 指定所上传文件的总大小不能超过200*1000*1024KB。注意maxUploadSize属性的限制不是针对单个文件，而是所有文件的容量之和 -->
   <property name="maxUploadSize" value="204800000" />
   <property name="maxInMemorySize" value="40960" />
</bean>
```

升级SpringBoot后，需要在代码中使用配置类配置MultipartResolver处理器[^2]

```java
    /**
     * 文件上传Resolver
     * @return
     */
    @Bean(name="multipartResolver")
    public MultipartResolver multipartResolver(){
        CommonsMultipartResolver resolver = new CommonsMultipartResolver();
        resolver.setDefaultEncoding("UTF-8");
        resolver.setMaxUploadSize(204800000L);
        resolver.setMaxInMemorySize(40960);
        return resolver;
    }
```

### 3.Ehcache缓存不生效

原先的Ehcache配置被删除，ehcacheConfig.xml仍然保留

```xml
	<!-- ehcache -->
	<bean id="cacheManagerFactory" class="org.springframework.cache.ehcache.EhCacheManagerFactoryBean">  
       <property name="configLocation">    
            <value>classpath:cache/ehcacheConfig.xml</value>    
       </property>   
    </bean>
```

在yaml配置文件中配置即可。

```yaml
spring:
  cache:
    ehcache:
      config: classpath:pro/ehcacheConfig.xml
    type: ehcache
```

另外，之前的Ehcache工具类中的由`net.sf.ehcache.CacheManager`变为`org.springframework.cache.CacheManager`，一些API做相应的改变,例如：

```java
CacheManager CACHEMANAGER = (CacheManager)SpringBeanUtil.getBean("cacheManagerFactory");
// 获取CacheManager由之前配置文件定义的cacheManagerFactory变为Spring自动注入的cacheManager
CacheManager CACHE_MANAGER = (CacheManager) SpringBeanUtil.getBean("cacheManager");


CACHEMANAGER.getCache(COMMON_CACHE).remove(key);
CACHEMANAGER.getCache(SESSION_CACHE).removeAll();
// remove方法修改为evict，removeAll方法修改为clear
CACHE_MANAGER.getCache(COMMON_CACHE).evict(key);
CACHE_MANAGER.getCache(SESSION_CACHE).clear();
```

### 4.Sonar单元测试覆盖率

Sonar单元测试覆盖率排除某些包[^3]，在pom.xml的`properties`中添加`sonar.coverage.exclusions`

```xml
<properties>
    <sonar.coverage.exclusions>
       **/src/main/java/com/xxx/xxx/controller/**/*
    </sonar.coverage.exclusions>
</properties>
```

## 总结

总体思路是先添加启动类和相关Jar包，项目启动后再一步步修改错误。

**参考**

[^1]: [Maven的单元测试没有执行的问题_liaowenxiong的博客-CSDN博客_mvn test 不执行](https://blog.csdn.net/liaowenxiong/article/details/122733680)

[^2]: [Unable to process parts as no multi-part configuration has been provided解决办法_luffy5459的博客-CSDN博客](https://blog.csdn.net/feinifi/article/details/95965421)

[^3]: [Analysis Parameters - SonarQube-7.0](https://docs.sonarqube.org/7.0/AnalysisParameters.html)

[^4]:[服务监控 | 万字长文详解Micrometer - 掘金 (juejin.cn)](https://juejin.cn/post/7051109463180181535#heading-27)
