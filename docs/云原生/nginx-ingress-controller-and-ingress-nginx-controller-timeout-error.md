---
title: 'K8s中的两种nginx-ingress-controller及其区别'
date: 2022-11-16 22:10:36
tags:
  - k8s
  - nginx-ingress
categories: 云原生
description: 注解没生效？可能是ingress-controller不对应。介绍K8s中的两种nginx-ingress-controller及其区别。
---

有两种基于 NGINX 的 Ingress 控制器实现：一种是[nginxinc/kubernetes-ingress](https://github.com/nginxinc/kubernetes-ingress)，另一种是[kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx)。

## 什么是Ingress Controller?

为了让 Ingress 资源工作，集群中至少要有一个 Ingress Controller运行。 Ingress Controller抽象出 Kubernetes 应用程序流量路由的复杂性，并在 Kubernetes 服务和外部服务（外部世界）之间提供桥梁。[^1]

您可以在集群中部署多个 Ingress Controller。这需要在创建 Ingress 时，使用适当的 `ingress.class` 注解 Ingress，以标识应使用哪个 Ingress Controller。如果没有定义指定，则使用默认的Ingress Controller。

**一般情况下，所有Ingress Controller都应满足此规范，但各种Ingress Controller的操作略有不同。**

目前有两种基于 NGINX 的 Kubernetes Ingress Controller——它们都是开源的并托管在 GitHub 上。一个是K8s开源社区的[kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx)，另一个是Nginx官方的[nginxinc/kubernetes-ingress](https://github.com/nginxinc/kubernetes-ingress)

## 主要区别

### Kubernetes Ingress Controller

这是k8s官方社区开发维护的控制器，它是基于Nginx的，扩展功能则需要使用Lua插件实现。

### NGINX Ingress Controller

这是由nginx的官方开发维护的控制器，它还有一个基于Nginx Plus的商业版本。NGINX 控制器具有高稳定性、持续向后兼容性、没有任何第三方模块、由于没有Lua 代码更高效（与k8s官方控制器相比）。

即使与官方控制器相比，免费软件版本也受到很大限制（由于没有Lua 模块）。同时，付费版本拥有相当广泛的附加功能：实时指标、JWT 验证、主动健康检查等。

关于 [nginxinc/kubernetes-ingress](https://github.com/nginxinc/kubernetes-ingress) 和[kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx) 的更多区别可见下表[^2]:

| Aspect or Feature | kubernetes/ingress-nginx | nginxinc/kubernetes-ingress with NGINX | nginxinc/kubernetes-ingress with NGINX Plus |
| --- | --- | --- | --- |
| **Fundamental** |
| Authors | Kubernetes community | NGINX Inc and community |  NGINX Inc and community |
| NGINX version | [Custom](https://github.com/kubernetes/ingress-nginx/tree/master/images/nginx) NGINX build that includes several third-party modules | NGINX official mainline [build](https://github.com/nginxinc/docker-nginx) | NGINX Plus |
| Commercial support | N/A | N/A | Included |
| Implemented in | Go/Lua (while Nginx is written in C) |  Go/Python |  Go/Python |
| **Load balancing configuration via the Ingress resource** |
| Merging Ingress rules with the same host | Supported | Supported via [Mergeable Ingresses](../examples/mergeable-ingress-types) | Supported via [Mergeable Ingresses](../examples/mergeable-ingress-types) |
| HTTP load balancing extensions - Annotations | See the [supported annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/) | See the [supported annotations](https://docs.nginx.com/nginx-ingress-controller/configuration/ingress-resources/advanced-configuration-with-annotations/) | See the [supported annotations](https://docs.nginx.com/nginx-ingress-controller/configuration/ingress-resources/advanced-configuration-with-annotations/)|
| HTTP load balancing extensions -- ConfigMap | See the [supported ConfigMap keys](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/configmap/) | See the [supported ConfigMap keys](https://docs.nginx.com/nginx-ingress-controller/configuration/global-configuration/configmap-resource/) | See the [supported ConfigMap keys](https://docs.nginx.com/nginx-ingress-controller/configuration/global-configuration/configmap-resource/) |
| TCP/UDP | Supported via a ConfigMap | Supported via custom resources | Supported via custom resources |
| Websocket  | Supported | Supported via an [annotation](../examples/websocket) | Supported via an [annotation](../examples/websocket) |
| TCP SSL Passthrough | Supported via a ConfigMap | Supported via custom resources | Supported via custom resources |
| JWT validation | Not supported | Not supported | Supported |
| Session persistence | Supported via a third-party module | Not supported | Supported |
| Canary testing (by header, cookie, weight) | Supported via annotations | Supported via custom resources | Supported via custom resources |
| Configuration templates | See the [template](https://github.com/kubernetes/ingress-nginx/blob/master/rootfs/etc/nginx/template/nginx.tmpl) | See the [templates](../internal/configs/version1) | See the [templates](../internal/configs/version1) |
| **Load balancing configuration via Custom Resources** |
| HTTP load balancing | Not supported | See [VirtualServer and VirtualServerRoute](https://docs.nginx.com/nginx-ingress-controller/configuration/virtualserver-and-virtualserverroute-resources/) resources | See [VirtualServer and VirtualServerRoute](https://docs.nginx.com/nginx-ingress-controller/configuration/virtualserver-and-virtualserverroute-resources/) resources |
| TCP/UDP load balancing | Not supported | See [TransportServer](https://docs.nginx.com/nginx-ingress-controller/configuration/transportserver-resource/) resource | See [TransportServer](https://docs.nginx.com/nginx-ingress-controller/configuration/transportserver-resource/) resource |
| TCP SSL Passthrough load balancing | Not supported | See [TransportServer](https://docs.nginx.com/nginx-ingress-controller/configuration/transportserver-resource/) resource | See [TransportServer](https://docs.nginx.com/nginx-ingress-controller/configuration/transportserver-resource/) resource |
| **Deployment** |
| Command-line arguments | See the [arguments](https://kubernetes.github.io/ingress-nginx/user-guide/cli-arguments/) | See the [arguments](https://docs.nginx.com/nginx-ingress-controller/configuration/global-configuration/command-line-arguments/) | See the [arguments](https://docs.nginx.com/nginx-ingress-controller/configuration/global-configuration/command-line-arguments/) |
| TLS certificate and key for the default server | Required as a command-line argument/ auto-generated | Required as a command-line argument | Required as a command-line argument |
| Helm chart | Supported | Supported | Supported |
| Operator | Not supported | Supported | Supported |
| **Operational** |
| Reporting the IP address(es) of the Ingress controller into Ingress resources | Supported | Supported | Supported |
| Extended Status | Supported via a third-party module | Not supported | Supported |
| Prometheus Integration | Supported | Supported | Supported |
| Dynamic reconfiguration of endpoints (no configuration reloading) | Supported with a third-party Lua module | Not supported | Supported |

## 实际使用差别

当我们实际使用上述两个版本的Ingress控制器(Nginx官方和Kubernetes官方)时，特别需要注意的就是他们所支持的Annotation不同（这也是在我工作中经常处理遇到的问题，经常搞混导致设置不生效），比如下面的这个问题：

我们有一个数据量大的导出接口阻塞等待大约5分钟，每次在刚好1分钟时接口报错`504 Gateway Time-out`，怎么处理？

如果只是nginx，这只需要设置nginx的`proxy-read-timeout`（顾名思义这个参数是设置nginx代理读取超时时间，默认60s)即可。比如**`proxy-read-timeout 600s`**

对于`kubernetes/ingress-nginx`需要使用**`nginx.ingress.kubernetes.io/proxy-read-timeout: "600"`** 

对于`nginxinc/kubernetes-ingress with NGINX`需要使用**`nginx.org/proxy-read-timeout: "10m"`**

更多注解上的使用区分可查看`kubernetes/ingress-nginx`： <https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/>，`nginxinc/kubernetes-ingress with NGINX`：<https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/>

## 参考：

[^1]:<https://grigorkh.medium.com/there-are-two-nginx-ingress-controllers-for-k8s-what-44c7b548e678>
[^2]:<https://gist.github.com/grigorkh/f8e4fd73e99f0fde06a51e2ed7c2156c>