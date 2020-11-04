---
title: 浅谈Spring定时任务的使用(@Scheduled注解)
date: 2020-11-03 17:43:39
tags:
  - @Scheduled
  - 定时任务
categories: Spring
---

### 环境说明

&emsp;&emsp;使用maven3、Spring4.3构建、jdk7编译、运行在tomcat7.0中。

### 定时任务的基本配置

pom.xml：加入依赖

```xml
  <properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <maven.compiler.source>1.7</maven.compiler.source>
    <maven.compiler.target>1.7</maven.compiler.target>
    <org.springframework.version>4.3.29.RELEASE</org.springframework.version>
  </properties>

  <dependencies>
    <!--SpringMVC依赖-->
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-webmvc</artifactId>
      <version>${org.springframework.version}</version>
    </dependency>
  </dependencies>
```

添加Spring配置文件applicationContext.xml：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns="http://www.springframework.org/schema/beans"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:task="http://www.springframework.org/schema/task"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans-4.3.xsd
       http://www.springframework.org/schema/context
       http://www.springframework.org/schema/context/spring-context-4.3.xsd
       http://www.springframework.org/schema/task
       http://www.springframework.org/schema/task/spring-task-4.3.xsd">

    <context:component-scan base-package="com.yyc"></context:component-scan>
    <task:annotation-driven />

</beans>
```

web.xml：配置如下

```xml
<web-app>
  <display-name>Archetype Created Web Application</display-name>
  <context-param>
    <param-name>contextConfigLocation</param-name>
    <param-value>classpath:applicationContext.xml</param-value>
  </context-param>
  <listener>
    <!--一定要有这个监听器-->  
    <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
  </listener>
</web-app>
```

使用`@Scheduled`注解开启定时任务

```java
package com.yyc;

import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.Date;

@Component
public class TaskImpl implements ITask{

    @Override
    @Scheduled(cron = "0/5 * * * * ? ") // cron表达式，每5秒执行一次
    public void taskMethod() {
        System.out.println("exec-"+new Date()+"--"+Thread.currentThread());
    }
}
```

### 遇到的问题

&emsp;&emsp;第一次使用`@Scheduled`注解进行定时任务使用，发现部署成功，但定时任务老是不执行。最终发现`web.xml`配置出现了问题，在`web.xml`中，只使用`context-param`标签初始化了Spring的配置文件，<span style="color:red">还需要加入`ContextLoaderListener`监听器的配置才可以</span>。百度一波，网友说到：`tomcat`启动时会加载`web.xml` 、加载`<listener> `和`<context-param>`属性，项目启动，会找这个监听器去查`contextConfigLocation`。

### 关于scheduler(调度线程)

&emsp;&emsp;当有多个`@Scheduled`定时任务时，我们可以配置Scheduler，即*调度线程池配置*，可以实现多个定时任务并行执行。

#### 未配置Scheduler的执行情况

&emsp;&emsp;先来看看未配置Scheduler的执行情况。定时任务1每5秒执行一次；定时任务2也是每5秒执行一次，但是在打印之前，我们sleep 10秒，所以定时任务2会每15秒输出一次。

```java
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.Date;

@Component
public class TaskImpl implements ITask{

    /**
     * 定时任务1
     */
    @Override
    //@Async
    @Scheduled(cron = "0/5 * * * * ? ")
    public void taskMethod1() {
        System.out.println("TASK1-"+new Date()+"--"+Thread.currentThread());
    }

    /**
     * 定时任务2
     * @throws InterruptedException
     */
    @Override
    @Scheduled(cron = "0/5 * * * * ? ")
    public void taskMethod2() throws InterruptedException {
        Thread.sleep(10*1000);
        System.out.println("TASK2-"+new Date()+"--"+Thread.currentThread());
    }
}
```

xml配置：

```xml
<context:component-scan base-package="com.yyc"></context:component-scan>
<task:annotation-driven />
```

输出结果：

```reStructuredText
TASK2-Wed Nov 04 15:13:30 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:13:30 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:13:45 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:13:45 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:14:00 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:14:00 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:14:15 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:14:15 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:14:30 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:14:30 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:14:45 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:14:45 CST 2020--Thread[pool-1-thread-1,5,RMI Runtime]
```

可以清晰的看到，<span style="color:red">未配置Scheduler时，任务1和任务2是串行方式执行的，都是每过15秒才打印一次，说明任何一个任务都需要等待其它任务执行完成，都是线程`pool-1-thread-1`执行的。</span>

#### 配置Scheduler的执行情况

xml配置：

```xml
<context:component-scan base-package="com.yyc"></context:component-scan>
<task:annotation-driven scheduler="dataScheduler"/>
<task:scheduler id="dataScheduler" pool-size="2"/>
```

输出结果：

```reStructuredText
TASK1-Wed Nov 04 15:35:50 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:35:55 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:36:00 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:36:00 CST 2020--Thread[dataScheduler-2,5,RMI Runtime]
TASK1-Wed Nov 04 15:36:05 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:36:10 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:36:15 CST 2020--Thread[dataScheduler-2,5,RMI Runtime]
TASK1-Wed Nov 04 15:36:15 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:36:20 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:36:25 CST 2020--Thread[dataScheduler-1,5,RMI Runtime]
TASK2-Wed Nov 04 15:36:30 CST 2020--Thread[dataScheduler-2,5,RMI Runtime]
```

为了方便查看，我们有两个任务配置`pool-size`为2。通过输出可以发现<span style="color:red">任务1和任务2并行执行，任务1每5秒输出一次（调度线程dataScheduler-1），任务2每15秒输出一次（调度线程dataScheduler-2）。</span>

### 关于executor(执行线程)

&emsp;&emsp;这里引入另一个参数，可以看任务 1上方注释掉的 `@Async` 注解：这个注解，代表可以异步执行。异步执行的话，调度线程池就会不用当前调度线程来执行，而是交给 `task:executor `这个*执行线程池*来执行。

我们使用`@Async`注解配置任务1，任务2不变：

```java
@Async
@Scheduled(cron = "0/5 * * * * ? ")
public void taskMethod1() {
   System.out.println("TASK1-"+new Date()+"--"+Thread.currentThread());
}
```

xml配置：

```xml
<context:component-scan base-package="com.yyc"></context:component-scan>
<task:annotation-driven scheduler="dataScheduler" executor="dataExecutor"/>
<task:scheduler id="dataScheduler" pool-size="2"/>
<task:executor id="dataExecutor" pool-size="10"/>
```

输出结果：

```reStructuredText
TASK1-Wed Nov 04 15:58:25 CST 2020--Thread[dataExecutor-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:58:30 CST 2020--Thread[dataExecutor-2,5,RMI Runtime]
TASK1-Wed Nov 04 15:58:35 CST 2020--Thread[dataExecutor-3,5,RMI Runtime]
TASK2-Wed Nov 04 15:58:35 CST 2020--Thread[dataScheduler-2,5,RMI Runtime]
TASK1-Wed Nov 04 15:58:40 CST 2020--Thread[dataExecutor-4,5,RMI Runtime]
TASK1-Wed Nov 04 15:58:45 CST 2020--Thread[dataExecutor-5,5,RMI Runtime]
TASK2-Wed Nov 04 15:58:50 CST 2020--Thread[dataScheduler-2,5,RMI Runtime]
TASK1-Wed Nov 04 15:58:50 CST 2020--Thread[dataExecutor-6,5,RMI Runtime]
TASK1-Wed Nov 04 15:58:55 CST 2020--Thread[dataExecutor-7,5,RMI Runtime]
TASK1-Wed Nov 04 15:59:00 CST 2020--Thread[dataExecutor-8,5,RMI Runtime]
TASK2-Wed Nov 04 15:59:05 CST 2020--Thread[dataScheduler-2,5,RMI Runtime]
TASK1-Wed Nov 04 15:59:05 CST 2020--Thread[dataExecutor-9,5,RMI Runtime]
TASK1-Wed Nov 04 15:59:10 CST 2020--Thread[dataExecutor-10,5,RMI Runtime]
TASK1-Wed Nov 04 15:59:15 CST 2020--Thread[dataExecutor-1,5,RMI Runtime]
TASK1-Wed Nov 04 15:59:20 CST 2020--Thread[dataExecutor-2,5,RMI Runtime]
TASK2-Wed Nov 04 15:59:20 CST 2020--Thread[dataScheduler-2,5,RMI Runtime]
TASK1-Wed Nov 04 15:59:25 CST 2020--Thread[dataExecutor-3,5,RMI Runtime]
```

可以发现，任务1使用了`@Async`注解后，任务1的线程是 dataExecutor-1 到 dataExecutor-10，说明 dataScheduler-1 这个调度线程调度了任务1，但是交给了线程池中的dataExecutor中的执行线程来具体执行的；而任务2没有使用`@Async`注解，所以还是使用dataScheduler-2 这个调度线程调度任务2。

### 总结

1. Spring定时任务，需要spring-context jar包，我这里为了方便直接用的mvc的包；
2. 配置的时候，一定要细心，配置文件schemaLocation等配置完整；
3. web.xml中一定要配置`org.springframework.web.context.ContextLoaderListener`这个监听器；
4. 配置task:scheduler参数的线程池，是为了根据任务总数来分配调度线程池的大小；而配置task:executor，是为了某个任务如果要异步的执行时，实现当前任务内的多线程并发。

### *参考*

> <https://blog.csdn.net/yx0628/article/details/80873774>