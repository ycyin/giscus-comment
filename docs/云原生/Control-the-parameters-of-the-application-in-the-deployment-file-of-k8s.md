---
title: 'K8s中的环境变量与应用程序的对应关系与操作'
date: 2022-06-16 14:48:08
tags:
  - k8s
  - springboot
categories: 云原生
description: 介绍如何通过K8s中的环境变量与应用程序进行交互的
---

## 前言

需求：需要在k8s的部署文件（Kind:Deployment）中定义变量，在应用程序中要能够接收变量值。

最终通过设置环境变量(ENV)来给应用程序传递参数。下面来简单分析一下。

## SpringBoot中如何接收运行参数的

首先我们先了解SpringBoot中如何接收运行参数。

通常我们以一个jar的方式运行程序，比如我们的命令为`java -jar -DDATE=20220616 /opt/app/app.jar ycyin 20220617`

在程序中我们尝试读取值：

```java
@SpringBootApplication
public class SpringbootApplication implements CommandLineRunner {
    protected static final Logger log = LoggerFactory.getLogger(SpringbootApplication.class);


    public static void main(String[] args) {
        SpringApplication.run(SpringbootApplication.class, args);
    }

    @Override
    public void run(String... args) {
        String date = System.getProperty("DATE");
        log.info("Logs date: {}", date);
        String dateE = System.getenv("DATE");
        log.info("Logs dateE: {}", dateE);
        for (String arg : args) {
            log.info("Logs arg: {}",arg);
        }
    }
}
```

输出：

```
Logs date: 20220616
Logs dateE: null
Logs arg: ycyin
Logs arg: 20220617
```

从结果中和查阅资料我们不难分析出：

- `System.getProperty()`获取到的是我们指定的`-DDATE=20220616`参数，其实这是一个JVM参数
- `System.getenv()`获取到的是我们系统的环境变量（可以设置系统环境变量试一下）
- `main函数的args`获取到的是我们指定的`ycyin 20220617`这两个参数，我称它为命令行参数

## 在Docker和K8s中传递参数给应用程序

根据上面`SpringBoot中如何接收运行参数的`分析，我们可以知道：

- 在程序中使用`System.getProperty()`获取参数就需要给其传递JVM参数
- 在程序中使用`System.getenv()`获取参数就需要设置系统环境变量
- 在SpringBoot`main函数的args`获取参数就需要给命令行参数

**在Docker的Dockerfile和K8s的yaml文件中，我们可以设置ENV环境变量，并且yaml中设置的环境变量可以覆盖Dockerfile的环境变量。**

如此，我们就可以通过以下Dockerfile和yaml来传递参数

```dockerfile
# 省略其它，也可以不用定义ENV，会由k8s启动容器时给传递
ENV TYPE=${TYPE}
ENV DATE=${DATE}

CMD ["sh", "-c", "exec java $JAVA_OPTS -jar /opt/app/app.jar $TYPE $DATE"]
```

```yaml
      containers:
        - name: c-release-name
          image: test
          imagePullPolicy: IfNotPresent
          securityContext:
            readOnlyRootFilesystem: true
            privileged: false
            runAsNonRoot: true
          env:
            - name: "JAVA_OPTS"
              value: "-Xmx1303m -Xms1303m -XX:MetaspaceSize=100m -XX:MaxMetaspaceSize=512m -Duser.language=zh -Duser.region=CN"
            - name: "MANAGEMENT_SERVER_PORT"
              value: "8081"
            - name: "SERVER_PORT"
              value: "8080"
            - name: "SPRING_PROFILES_ACTIVE"
              value: "prod"
            - name: "TYPE"
              value: "output"
            - name: "DATE"
              value: "20220614"
```

可以发现在Dockerfile CMD指定的命令中，`$JAVA_OPTS`是JVM参数、`$TYPE`和`$DATE`是命令行参数，但是他们都是通过ENV环境变量传递的。

所以应用程序就可以
通过使用`System.getProperty()`获取到`user.language`和`user.region`JVM参数
通过使用`System.getenv()`获取到`JAVA_OPTS`、`MANAGEMENT_SERVER_PORT`、`SERVER_PORT`、`SPRING_PROFILES_ACTIVE`、`TYPE`、`DATE`环境变量
通过SpringBoot`main函数的args`获取到`TYPE`、`DATE`这两个命令行参数

## 总结

我们可以通过在k8s的yaml中使用env环境变量的方式将参数传给Dockerfile（准确地说应该是传给容器运行时），Dockerfile再根据获取到的env环境变量分别视情况以JVM或命令行参数的形式（`java -jar`命令）传递给应用程序。