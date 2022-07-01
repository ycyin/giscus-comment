---
title: 'K8s中使用Ingress访问请求体过大问题解决'
date: 2022-07-01 14:29:11
tags:
  - k8s
  - nginx-ingress
categories: 云原生
description: 介绍K8s中使用Ingress访问请求体过大问题解决、使用nginx-ingress-controller
---

在k8s中使用了nginx-ingress-controller作为Ingress控制器，默认bodysize最大限制为1M，在类似文件上传下载比较大的请求中就会出现失败返回413状态码的情况。

解决：在Ingress的metadata中添加如下annotations

```yaml
nginx.ingress.kubernetes.io/proxy-body-size: 20M
```

根据Ingress-nginx工作原理：

> 1）ingress-controller通过和k8s api交互，动态感知集群中ingress规则变化；
>
> 2）根据自定义的ingress规则，生成一段nginx的Server配置；
>
> 3）在将其写到nginx-ingress-controller的pod里，这个nginx-ingress-controller的pod里运行着一个nginx服务，控制器会把生成的nginx配置写入`/etc/nginx/nginx.conf`文件中；
>
> 4）然后reload一下nginx配置生效。

会在nginx-ingress-controller的pod的`/etc/nginx/nginx.conf`配置文件对应的server中添加如下配置：

```ini
client_max_body_size     20M; #默认为1M
```

可以使用`kubectl cp`命令将配置文件copy出来

```shell
kubectl cp  ingress-nginx/nginx-ingress-controller-6dc776b7bc-2nfmw:etc/nginx/nginx.conf ~/ycyin/nginx.conf
```

关于`nginx.ingress.kubernetes.io/proxy-body-size`注解的更多信息：

<https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#custom-max-body-size>

关于Ingress中可添加的更多注解：

<https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/>