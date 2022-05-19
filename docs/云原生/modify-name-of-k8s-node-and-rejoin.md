---
title: 修改k8s节点主机名并重新加入集群
date: 2022-05-19 09:41:06
tags:
  - k8s
categories: 云原生
description: 介绍如何在K8s中修改节点主机名称并重新加入集群
---

# 修改k8s节点主机名并重新加入集群

k8s版本：v1.20.15

部署方式：二进制

目的：将节点名称为`k8s-node01`修改为`k8s-node1`，修改后需要删除节点重新加入k8s集群。

## 删除Node01节点

```shell
kubectl delete node k8s-node01
```

## 删除批准的kubelet证书申请

```shell
[root@k8s-master1 k8s]# kubectl get csr
NAME                                                   AGE   REQUESTOR           CONDITION
node-csr-WChHl5n7wueANacEBwkRQ-x28TEGYGBsTnxMRvJrX38   37m   kubelet-bootstrap   Approved,Issued
node-csr-X0W6e3GF196u_10PZEuV9qxrQSYgTUIkyKt8rY1hb5Y   13m   kubelet-bootstrap   Approved,Issued
node-csr-wIdvz5uElyaKQLxRzcI8f_N4TYQI0ipV2tJjfIdnj0E   26m   kubelet-bootstrap   Approved,Issued
[root@k8s-master1 k8s]# kubectl delete csr node-csr-WChHl5n7wueANacEBwkRQ-x28TEGYGBsTnxMRvJrX38
certificatesigningrequest.certificates.k8s.io "node-csr-WChHl5n7wueANacEBwkRQ-x28TEGYGBsTnxMRvJrX38" delete
```

在node01节点上删除master节点批准其加入集群时，自动颁发的证书：

自动颁发的证书，在Node节点上的目录：`/opt/kubernetes/ssl/`
删除证书自动颁发的是kubelet的证书，注意查看可能还有其它不能删文件，自行甄别

```shell
rm -f /opt/kubernetes/ssl/kubelet*
```

## 修改Node01主机名配置

```bash
vi /opt/kubernetes/cfg/kubelet.conf
# 修改
--hostname-override=k8s-node1

vi /opt/kubernetes/cfg/kube-proxy-config.yml
# 修改
hostnameOverride: k8s-node1
```

## 修改master节点的hosts

```
cat >> /etc/hosts << EOF 
192.168.88.113 k8s-master1 
192.168.88.123 k8s-node1 # 我们修改的
192.168.88.124 k8s-node2 
EOF 
```

## 重启Node1的kubelet和kube-proxy

```shell
systemctl restart kubelet
systemctl restart kube-proxy
```

## 重新批准kubelet证书申请

此时在master节点执行：kubectl get csr 可以看到node1节点重新申请加入集群

```shell
[root@k8s-master1 ~]# kubectl get csr
NAME                                                   AGE   REQUESTOR           CONDITION
node-csr-o-EQcnmUdhShDN1qDpuMEBtcg124OCBeatJezPYnefw   3s    kubelet-bootstrap   Pending
[root@k8s-master1 ~]# kubectl certificate approve node-csr-o-EQcnmUdhShDN1qDpuMEBtcg124OCBeatJezPYnefw
```

*参考：*

[k8s node节点删除并重新加入_人生匆匆的博客-CSDN博客_k8s 删除node节点,重新加入](https://blog.csdn.net/a13568hki/article/details/123635793)
