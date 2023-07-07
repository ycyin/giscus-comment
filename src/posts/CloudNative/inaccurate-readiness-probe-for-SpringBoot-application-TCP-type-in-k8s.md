---
title: '关于k8s中对于SpringBoot应用TCP类型的就绪探针不准确的问题发现'
date: 2022-06-25 14:56:43
tag:
  - k8s
  - Spring Boot
category: 云原生
description: 关于k8s中对于SpringBoot应用TCP类型的就绪探针不准确的问题发现
---

在K8s中我们知道可以使用Exec或TCP或HTTP对应用进行就绪探针检测和存活检测、以便K8s可以对应用进行平滑更新、升级、关停等。最近在K8s中部署SpringBoot应用，使用TCP 8080(应用端口)进行就绪探针检测，在更新应用时发现了一个问题。

由于该应用启动时间比较长，大概60s，K8s设定每15秒进行一次TCP就绪探针检测，发现进行应用更新过程中，新版本还未完全启动时便kill掉了老版本，导致应用出现大概35秒的时间不可用，使用`kubectl get pod -w`观察过程如下：

使用TCP Socket进行就绪探测：

```
NAME                                       READY   STATUS            RESTARTS   AGE
configcenter-6776d8df57-rx9jh              0/2     PodInitializing   0          13s
configcenter-88b79dbf9-k8fqr               2/2     Running           0          97m
configcenter-6776d8df57-rx9jh              0/2     Running           0          14s
configcenter-6776d8df57-rx9jh              1/2     Running           0          15s
configcenter-6776d8df57-rx9jh              2/2     Running           0          25s
configcenter-88b79dbf9-k8fqr               2/2     Terminating       0          97m
configcenter-88b79dbf9-k8fqr               0/2     Terminating       0          97m
configcenter-88b79dbf9-k8fqr               0/2     Terminating       0          97m
configcenter-88b79dbf9-k8fqr               0/2     Terminating       0          97m
```

可以发现新版本在25秒时状态已经变为Running状态，紧接着旧版本就处于Terminating状态，而实际上应用启动需要耗时60秒。这就出现了新版本还未真正就绪就杀死了旧版本Pod导致应用短时不可用现象。

使用HTTP进行就绪探测：

```
NAME                                       READY   STATUS            RESTARTS   AGE
configcenter-6776d8df57-rx9jh              2/2     Running           0          6m38s
configcenter-5c86fb6b57-fndqw              0/2     PodInitializing   0          2s
configcenter-5c86fb6b57-fndqw              0/2     Running           0          14s
configcenter-5c86fb6b57-fndqw              1/2     Running           0          15s
configcenter-5c86fb6b57-fndqw              2/2     Running           0          65s
configcenter-6776d8df57-rx9jh              2/2     Terminating       0          8m7s
configcenter-6776d8df57-rx9jh              0/2     Terminating       0          8m13s
configcenter-6776d8df57-rx9jh              0/2     Terminating       0          8m14s
configcenter-6776d8df57-rx9jh              0/2     Terminating       0          8m14s
```

发现这个问题后改为HTTP进行就绪探测，可以从上面的新旧版本Pod切换状态观察可以看出这次就是正常的，新版本在65秒时才是Running状态已经完全就绪，这时再杀死旧Pod已经完全没问题了。

**原因猜测**

没有深究这个问题，但是根据经验应该可以猜出大致问题所在：SpringBoot在启动过程中先启动了内置的Tomcat打开了应用8080端口，此时外部其实可以通过TCP进行连接这个端口了，而我们的Web应用还未就绪，HTTP请求也还进不来各种API服务还未提供。

**总结**

在K8s中部署SpringBoot应用，对应用进行就绪探针检测尽量使用HTTP类型更为准确，可以在应用中自己写一个`/healthz`接口（Google推荐这个接口名），或者可以通过加入监控包Prometheus提供默认的Http接口（xxx:8081/actuator/health）。

另外，如果项目出现OOM异常，使用TCP探针K8s也是无法检测到进行重启容器的。