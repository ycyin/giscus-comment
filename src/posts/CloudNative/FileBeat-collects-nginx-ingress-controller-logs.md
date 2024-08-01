---
title: 'FileBeat收集nginx-ingress-controller日志'
date: 2024-08-01 09:33:45
tag:
  - k8s
  - nginx-ingress
category: 云原生
description: 本文介绍一种如何把nginx-ingress-controller的日志通过Filebeat收集，最终到ES中查看。
---

在云原生环境下使用nginx-ingress-controller作为网关服务，我们希望能监控网关流量，重点监控访问者的IP和访问的服务。目前使用比较多的两种基于 NGINX 的 Ingress 控制器实现：一种是[nginxinc/kubernetes-ingress](https://github.com/nginxinc/kubernetes-ingress)，另一种是[kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx)，我们使用的是`nginxinc/kubernetes-ingress`，它是nginx社区维护的一个版本。开始准备通过metric暴露nginx-ingress-controller的监控指标，使用Prometheus进行采集，发现nginx社区维护的这个开源版kubernetes-ingress可收集的监控指标非常少。我们需要的信息其实Nginx都有打印日志，所以，我们决定采集nginx-ingress-controller的日志，最终收集到ES中进行存储，后期就可以使用Kibana查询这些日志，甚至对这些日志进行分析。

<!-- more -->

## 涉及组件

nginxinc/kubernetes-ingress Helm部署
helm.sh/chart版本：nginx-ingress-0.10.4 ，镜像：deploy.bocloud.k8s/nginx/nginx-ingress:1.12.4 

filebeat:7.13.4 Helm部署
elasticsearch:v 7.8.0 集群

## 实现
首先，我们要让nginx-ingress-controller打印出json日志，使用[官方提供的log-format配置实现](https://docs.nginx.com/nginx-ingress-controller/configuration/global-configuration/configmap-resource/#logging)
```yaml
│ apiVersion: v1                                                                                                                                                                                  
│ data:                                                                                                                                                                                           
│   log-format: '{"time": "$time_iso8601", "remote_addr": "$remote_addr", "x_forwarded_for":                                                                                                      
│     "$proxy_add_x_forwarded_for", "remote_user": "$remote_user", "bytes_sent": $bytes_sent,                                                                                                     
│     "request_time": $request_time, "status": $status, "vhost": "$host", "request_proto":                                                                                                        
│     "$server_protocol", "path": "$uri", "request_query": "$args", "request_length":                                                                                                             
│     $request_length, "duration": $request_time,"method": "$request_method", "http_referrer":                                                                                                    
│     "$http_referer", "http_user_agent": "$http_user_agent"}'                                                                                                                                    
│   log-format-escaping: default                                                                                                                                                                  
│   server-tokens: "false"                                                                                                                                                                        
│ kind: ConfigMap                                                                                                                                                                                 
│ metadata:                                                                                                                                                                                       
│   annotations:                                                                                                                                                                                  
│     meta.helm.sh/release-name: my-nginx-ingress                                                                                                                                                
│     meta.helm.sh/release-namespace: nginx-ingress                                                                                                                                               
│   labels:                                                                                                                                                                                       
│     app.kubernetes.io/instance: my-nginx-ingress                                                                                                                                               
│     app.kubernetes.io/managed-by: Helm                                                                                                                                                          
│     app.kubernetes.io/name: my-nginx-ingress-nginx-ingress                                                                                                                                     
│     helm.sh/chart: nginx-ingress-0.10.4                                                                                                                                                         
│   name: my-nginx-ingress-nginx-ingress                                                                                                                                                         
│   namespace: nginx-ingress                                                                                                                                                                       
```
然后，我们发现nginx-ingress的日志并没有打印到.log文件中，而是被重定向到标准输出中。
```bash
[root@Ubuntu ~]$ kubectl exec -it my-nginx-ingress-nginx-ingress-68f94c8866-99p4d -- ls -l /var/log/nginx
total 0
lrwxrwxrwx 1 root root 11 Mar 17  2022 access.log -> /dev/stdout
lrwxrwxrwx 1 root root 11 Mar 17  2022 error.log -> /dev/stderr
```
在宿主机的/var/log目录下存放了所有容器的标准输出日志。

> Note:/var/log/containers/.log is normally a symlink to /var/log/pods//*/.log

所以，我们只需要让Filebeat收集/var/log目录下对应容器的日志就可以了。这里我们使用了flexVolume来挂载文件，也可以使用其他方式。
如下是Filebeat helm包的values.yaml文件部分关键内容：

```yaml
daemonset:
 enabled: true
 extraVolumeMounts:
 - mountPath: /var/log/pods
   name: pods
   readOnly: true
 - mountPath: /var/log/containers
   name: containers
   readOnly: true
 extraVolumes:
 - flexVolume:
     driver: mydriver/hostpath
     options:
       driver.root: /var/log/containers
   name: containers
 - flexVolume:
     driver: mydriver/hostpath
     options:
       driver.root: /var/log/pods
   name: pods
 filebeatConfig:
   filebeat.yml: |
     filebeat.inputs:
     - type: container
       id: my-nginx-ingress
       paths:
         - /var/log/containers/my-nginx-ingress-nginx-ingress-*.log
       processors:
       - replace:
           fields:
           - field: "log.file.path"
             pattern: "/var/log/containers/my-nginx-ingress-nginx-ingress-"
             replacement: "/opt/applog/cluster-demo/nginx-ingress/my-nginx-ingress/nginx-ingress-"
           ignore_missing: false
           fail_on_error: true
       - add_fields:
           target: kubernetes
           fields:
             namespace: cluster-ingress-nginx
             labels:
               app: nginx-ingress-controller
       - decode_json_fields:
           fields: ["message"]
           process_array: false
           max_depth: 1
           target: ""
           overwrite_keys: false
           add_error_key: true
       - drop_fields:
           when:
             has_fields: ['message']
           fields: ["message"]
           ignore_missing: false
```

配置中包含日志文件的挂载，这里不再赘述，主要看看filebeat.yml文件的配置
首先使用[filebeat-input-container](https://www.elastic.co/guide/en/beats/filebeat/7.17/filebeat-input-container.html)收集nginx-ingress-controller的log文件
最后配置了4个processors，分别是[replace](https://www.elastic.co/guide/en/beats/filebeat/8.14/replace-fields.html)、[add_fields](https://www.elastic.co/guide/en/beats/filebeat/7.17/add-fields.html)、[decode_json_fields](https://www.elastic.co/guide/en/beats/filebeat/7.17/decode-json-fields.html)和[drop_fields](https://www.elastic.co/guide/en/beats/filebeat/7.17/drop-fields.html)

replace和add_fields: 由于我们的业务日志大多是指定目录规则存储在宿主机的/opt/applog目录下，通过filebeat的autodiscover收集(如下配置)后发送到kafka,然后logstash取出数据进行处理，在处理时我们需要根据路径和字段名取出对应的值进行逻辑处理。所以对于这种特殊的/var/log/目录下的日志,logstash无法处理，我们需要根据规则replace替换log.file.path以及添加一些我们需要的字段。
```yaml
filebeat.autodiscover:
  providers:
    - type: kubernetes
      hints.enabled: true
      hints.default_config.enabled: false
      hints.default_config:
        type: log
        paths:
          - /opt/applog/${data.kubernetes.namespace}/${data.kubernetes.labels.app}/${data.kubernetes.pod.name}/**/*.log
          - /opt/applog/${data.kubernetes.namespace}/${data.kubernetes.labels.app}/${data.kubernetes.pod.name}/**/*.json
        ignore_older: 48h
        clean_inactive: 72h
```
decode_json_fields和drop_fields：nginx-ingress-controller打印出json日志到/var/log/containers目录文件下后格式如下
```json
{
  "log": {
    "time": "2024-08-01T02:52:15+00:00",
    "status": 304,
    "vhost": "app.com",
    "request_proto": "HTTP/1.1",
    "request_length": 945,
    "duration": 0.209,
    "method": "GET",
    "path": "/user/get",
    // 省略其它字段
  },
  "stream": "stdout",
  "time": "2024-08-01T02:52:15.053975954Z"
}
```
filebeat收集时将这个json结构中的log字段下的内容放到message字段下（猜测是type: container干的？这里不去追究），这在elasticsearch中使用kibana查询时不太友好（不能解析为“可用字段”就不能根据我们需要的字段筛选比如:vhost）。我们希望将message中的json字段解码出来方便搜索和筛选，就要用到decode_json_fields，解码完成后将message字段删除使用drop_fields。
