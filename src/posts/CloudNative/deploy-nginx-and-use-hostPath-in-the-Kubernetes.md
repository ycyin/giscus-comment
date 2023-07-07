---
title: 'Kubernetes:使用hostPath挂载nginx集群的配置文件和html'
date: 2020-12-29 15:47:41
tag:
  - k8s
  - 微服务
category: 云原生
---

## 前言
[Kubernetes 卷（Volume）](https://kubernetes.io/zh/docs/concepts/storage/volumes/)有很多的类型，hostPath方式只是其中一个，关于hostPath，它的定位可能还是一个比较简单的应用设计，例如demo，测试等，因为它需要在每一个node节点都要有对应的挂载目录/文件。比如在k8s集群中，Master调用nginx服务，他可能会分配到多个节点，例如有2个node节点，这次nginx服务被分配到了node2节点，如果node2节点没有建立相应的目录以及配置文件，就会映射失败，那么怎么解决这个问题？

- 有一个方案比较省事，用ansible自动化运维，批量建立，但是这样的话，还不如使用NFS或者gluster进行挂载，更省事；
- 第二个方案：使用scp命令，将一台机器上的文件复制到其它Node节点机器上，比较麻烦，但是用来部署demo足够了。

本文使用方案二hostPath挂载nginx集群的配置文件和html目录，用来部署demo。

## 一、建立相关的配置文件和目录

我这里使用的是nginx1.18.0版本，配置文件可以映射`/etc/nginx/conf.d`这个文件夹即可。
在Master机器上创建文件夹 `/nginx/conf/conf.d` 新建一个`default.conf`文件，内容如下：

```
server {
    listen       80;
    server_name  localhost;

    #charset koi8-r;
    #access_log  /var/log/nginx/host.access.log  main;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }
  
    location /s {
        proxy_pass http://baidu.com;
    }
}	
```

在Master机器上创建文件夹 `/nginx/html` 新建一个`index.html`文件，随便填点内容，作为主页文件方便测试。

## 二、将/nginx文件夹拷贝到Node机器上

使用scp命令：`scp 源路径 登录名@IP:目标路径`

```shell
scp -r /nginx centos@k8s-node1:/
#scp -r /nginx centos@172.26.11.139:/
```

`-r`表示递归拷贝目录 ，如果遇到权限不足，可先在Node机上新建好/nginx文件夹，然后给`chmod 777 /nginx`权限，再一个一个子目录拷贝。

## 三、声明式创建Deployment

deployment.yaml:

```yaml
apiVersion: apps/v1  #api版本定义
kind: Deployment  #定义资源类型为Deploymant
metadata:  #元数据定义
  name: nginx-deploy  #deployment控制器名称
  namespace: default  #名称空间
spec:  #deployment控制器的规格定义
  replicas: 2  #定义deployment副本数量为2个
  selector:  #标签选择器，定义匹配Pod的标签
    matchLabels:
      app: nginx-deploy
  template:  #Pod的模板定义
    metadata:  #Pod的元数据定义
      labels:  #定义Pod的标签，和上面的标签选择器标签一致，可以多出其他标签
        app: nginx-deploy
    spec:  #Pod的规格定义
      volumes:
      - name: nginx-conf
        hostPath:
          path: /nginx/conf/conf.d
          #type: DirectoryOrCreate
      - name: htmls
        hostPath:
          path: /nginx/html #node节点的宿主机目录
          #type: DirectoryOrCreate
      containers:  #容器定义
        - name: nginx  #容器名称
          image: nginx:1.18.0  #容器镜像
          volumeMounts:
              #这个目录下的配置文件在nginx.conf中的http节点下include,所以我们只需要挂载这个目录即可
            - mountPath: /etc/nginx/conf.d 
              name: nginx-conf
            - mountPath: /usr/share/nginx/html
              name: htmls
          ports:  #暴露端口
            - name: http  #端口名称
              containerPort: 80
```

创建：

```shell
kubectl apply -f deployment.yaml
```

一些命令：

> 记不住可以通过`kubectl --help`查看命令，每一个命令下的子命令也可以这样查，如：`kubectl rollout --help`


```shell
#查看Pod状态
kubectl get pods
#查看Pod 日志
kubectl logs [pod name]
#查看deployment状态
kubectl get deployments
#重新启动deployment（会重新创建）
kubectl rollout restart deployment/nginx-deploy
#进入指定pod
kubectl exec [pod name] -it bash
#kubectl exec nginx-deploy-7b5bc9d54d-nrf58 -it bash
```

## 四、创建Service并向集群外暴露端口

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  type: NodePort #使用NodePort向外暴露端口
  selector:
    app: nginx-deploy #Pod的标签
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
      nodePort: 30001 #暴露的端口为30001
```

## 五、测试

此时可以尽情测试了，访问`http://MasterIP:30001`，`http://MasterIP:30001/s` ,改改/nginx下的配置文件或者主页等再测试都可以了（每次改完需要scp到Node上，比较麻烦）。



本文参考：

1、https://kubernetes.io/zh/docs/concepts/storage/volumes/#hostpath

2、 https://blog.csdn.net/weixin_45005209/article/details/107780463 