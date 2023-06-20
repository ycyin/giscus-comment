---
title: '关于SSM项目停止Tomcat时Log4j出现java.lang.NoClassDefFoundError:'
date: 2020-03-29 14:43:41
tag:
  - tomcat
  - SSM
  - Log
category: Spring
---

## 异常重现

SSM项目集成Log4j日志系统，在tomcat中运行，点击idea的红色停止按钮停止项目时，控制台出现一个关于Log4j的`java.lang.NoClassDefFoundError:org/apache/logging/log4j/message/ParameterizedNoReferenceMessageFactory$StatusMessage`异常，详细异常信息如下：

<!--more-->

```java
Exception in thread "pool-1-thread-1" java.lang.NoClassDefFoundError: org/apache/logging/log4j/message/ParameterizedNoReferenceMessageFactory$StatusMessage
	at org.apache.logging.log4j.message.ParameterizedNoReferenceMessageFactory.newMessage(ParameterizedNoReferenceMessageFactory.java:105)
	at org.apache.logging.log4j.message.AbstractMessageFactory.newMessage(AbstractMessageFactory.java:75)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessage(AbstractLogger.java:2010)
	at org.apache.logging.log4j.spi.AbstractLogger.logIfEnabled(AbstractLogger.java:1884)
	at org.apache.logging.log4j.spi.AbstractLogger.error(AbstractLogger.java:793)
	at org.apache.logging.log4j.core.util.DefaultShutdownCallbackRegistry.run(DefaultShutdownCallbackRegistry.java:74)
	at java.lang.Thread.run(Thread.java:748)
Caused by: java.lang.ClassNotFoundException: Illegal access: this web application instance has been stopped already. Could not load [org.apache.logging.log4j.message.ParameterizedNoReferenceMessageFactory$StatusMessage]. The following stack trace is thrown for debugging purposes as well as to attempt to terminate the thread which caused the illegal access.
	at org.apache.catalina.loader.WebappClassLoaderBase.checkStateForClassLoading(WebappClassLoaderBase.java:1343)
	at org.apache.catalina.loader.WebappClassLoaderBase.loadClass(WebappClassLoaderBase.java:1206)
	at org.apache.catalina.loader.WebappClassLoaderBase.loadClass(WebappClassLoaderBase.java:1167)
	... 7 more
Caused by: java.lang.IllegalStateException: Illegal access: this web application instance has been stopped already. Could not load [org.apache.logging.log4j.message.ParameterizedNoReferenceMessageFactory$StatusMessage]. The following stack trace is thrown for debugging purposes as well as to attempt to terminate the thread which caused the illegal access.
	at org.apache.catalina.loader.WebappClassLoaderBase.checkStateForResourceLoading(WebappClassLoaderBase.java:1353)
	at org.apache.catalina.loader.WebappClassLoaderBase.checkStateForClassLoading(WebappClassLoaderBase.java:1341)
	... 9 more
```

## 解决方法

> Log4j在使用前需要初始化init()，在使用完成后同样需要destory()，在servlet的destory()方法中添加“LogManager.shutdown()；”

方法一（**优先考虑**）：可能是由于SSM项目中未加入`log4j-web.jar`这个依赖包导致的，这个依赖包中主要实现在web项目中使用Log4j时的一些Servlet初始化和销毁相关的操作。在`pom.xml`中加入这个包即可。

```xml
<!-- Log4j start -->
<!-- log4j-slf4j-impl -->
<dependency>
     <groupId>org.apache.logging.log4j</groupId>
     <artifactId>log4j-slf4j-impl</artifactId>
     <version>2.6.2</version>
</dependency>
<!-- log4j-core -->
<dependency>
     <groupId>org.apache.logging.log4j</groupId>
     <artifactId>log4j-core</artifactId>
     <version>2.6.2</version>
</dependency>

<!-- log4j-web -->
<dependency>
     <groupId>org.apache.logging.log4j</groupId>
     <artifactId>log4j-web</artifactId>
     <version>2.6.2</version>
</dependency>
<!-- Log4j end -->
```

方法二：使用注解的方式实现Spring中bean初始化及销毁：

```java
@Component
public class loggerService {

    @PostConstruct
    public void init(){//项目启动时初始化bean就会先执行这个方法
        System.out.println("-init-");
    }

    @PreDestroy
    public  void destroy(){//项目关闭前就会先执行这个方法
        System.out.println("-destroy-");
        LogManager.shutdown();
    }
}
```

方法三：使用xml的方式实现Spring中bean初始化及销毁：

Spring的xml中配置：

```xml
<bean id="loggerService" class="com.yyc.loggerService"   init-method="init" destroy-method="destroy" />
```

Java代码：

```java
public class loggerService {

    public void init(){//项目启动时初始化bean就会先执行这个方法
        System.out.println("-init-");
    }

    public  void destroy(){//项目关闭前就会先执行这个方法
        System.out.println("-destroy-");
        LogManager.shutdown();
    }
}
```

我这里由于是SSM项目，所以使用方法一加入`log4j-web.jar`这个依赖包就可以了，同时试验了方法二、三也是可行的，希望对您有帮助。

本文参考：

1、 https://blog.csdn.net/yulsh/article/details/68065512 

2、 https://blog.csdn.net/xoopx/article/details/44453831 