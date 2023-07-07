---
title: 'K8s中的coredns无法解析svc问题排查'
date: 2022-07-29 14:41:48
tag:
  - k8s
  - coredns
category: 云原生
description: 介绍K8s中的coredns无法解析svc服务名

---

我们知道k8s中可以通过服务名进行调用，初次部署coredns后正常运行但无法解析服务名，导致各pod之间通信不能通过svc，排查后发现kube-proxy报如下错误：

```
[root@k8s-node2 ~]# systemctl status kube-proxy -l
● kube-proxy.service - Kubernetes Proxy
   Loaded: loaded (/usr/lib/systemd/system/kube-proxy.service; enabled; vendor preset: disabled)
   Active: active (running) since Sun 2022-04-24 22:46:27 EDT; 6h ago
 Main PID: 3134 (kube-proxy)
   CGroup: /system.slice/kube-proxy.service
           └─3134 /opt/kubernetes/bin/kube-proxy --logtostderr=false --v=2 --log-dir=/opt/kubernetes/logs --config=/opt/kubernetes/cfg/kube-proxy-config.yml

Apr 24 22:46:27 k8s-node2 systemd[1]: Started Kubernetes Proxy.
Apr 24 22:46:31 k8s-node2 kube-proxy[3134]: E0424 22:46:31.258995    3134 node.go:161] Failed to retrieve node info: Get "https://192.168.88.113:6443/api/v1/nodes/k8s-node2": dial tcp 192.168.88.113:6443: connect: no route to host
Apr 24 22:46:45 k8s-node2 kube-proxy[3134]: E0424 22:46:45.979680    3134 node.go:161] Failed to retrieve node info: Get "https://192.168.88.113:6443/api/v1/nodes/k8s-node2": net/http: TLS handshake timeout
Apr 24 22:46:56 k8s-node2 kube-proxy[3134]: E0424 22:46:56.589155    3134 proxier.go:1644] Failed to delete stale service IP 10.0.0.2 connections, error: error deleting connection tracking state for UDP service IP: 10.0.0.2, error: error looking for path of conntrack: exec: "conntrack": executable file not found in $PATH
Apr 24 22:47:25 k8s-node2 kube-proxy[3134]: E0424 22:47:25.572468    3134 proxier.go:778] Failed to delete kube-system/kube-dns:dns endpoint connections, error: error deleting conntrack entries for udp peer {10.0.0.2, 10.244.1.27}, error: error looking for path of conntrack: exec: "conntrack": executable file not found in $PATH
Apr 25 05:06:00 k8s-node2 kube-proxy[3134]: E0425 05:06:00.578223    3134 proxier.go:778] Failed to delete kube-system/kube-dns:dns endpoint connections, error: error deleting conntrack entries for udp peer {10.0.0.2, 10.244.1.31}, error: error looking for path of conntrack: exec: "conntrack": executable file not found in $PATH
Apr 25 05:06:08 k8s-node2 kube-proxy[3134]: E0425 05:06:08.888616    3134 proxier.go:1644] Failed to delete stale service IP 10.0.0.2 connections, error: error deleting connection tracking state for UDP service IP: 10.0.0.2, error: error looking for path of conntrack: exec: "conntrack": executable file not found in $PATH
```

解决：

从kube-proxy入手，最后发现当前CentOS 系统，内核版本为 3.10，升级系统内核版本得到解决。

排查过程可参考如下链接。

参考：

<https://www.it610.com/article/1304231658370666496.htm>
<https://blog.csdn.net/AbnerKou/article/details/122515118>
<https://blog.csdn.net/xuxingzhuang/article/details/117019186>
<https://www.cnblogs.com/wangz-/articles/13034702.html>