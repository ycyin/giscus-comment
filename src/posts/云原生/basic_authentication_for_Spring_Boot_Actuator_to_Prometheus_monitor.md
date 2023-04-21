---
title: 'Prometheus中Monitor添加对SpringBoot Actuator的Basic认证'
date: 2023-2-18 17:52:43
tags:
  - Prometheus
  - Spring Boot
categories: 云原生
description: 一般地，我们使用Prometheus对SpringBoot应用进行监控时，没有做任何认证，监控接口是完全开放的，这在某些程度上不安全。
---

## 背景

一般地，我们使用Prometheus对SpringBoot应用进行监控时，没有做任何认证，监控接口是完全开放的，我们直接访问暴露出来的指标接口`http://localhost:8081/actuator/prometheus`就可以拿到指标接口，这在某些程度上不安全。。

我们需要给我们的监控指标接口添加一个Base认证。

## 应用添加Basic认证

我这里是SpringBoot2.3.9版本，在添加spring-boot-starter-actuator和micrometer-registry-prometheus做指标暴露外，还在此基础之上还需要添加spring-boot-starter-security包。

```xml
<!-- 监控检查及度量 -->
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
	<groupId>io.micrometer</groupId>
	<artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

添加配置类以拦截指标暴露Endpoint端口，ENDPOINT_ADMIN角色可自定义：

```java
import org.springframework.boot.actuate.autoconfigure.security.servlet.EndpointRequest;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;

@Configuration(proxyBeanMethods = false)
public class ActuatorSecurity extends WebSecurityConfigurerAdapter {

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.requestMatcher(EndpointRequest.toAnyEndpoint()).authorizeRequests((requests) ->
                requests.anyRequest().hasRole("ENDPOINT_ADMIN"));
        http.httpBasic();
    }

}
```

添加配置：

```yaml
management:
  server:
    port: 8081
  endpoints:
    web:
      exposure:
        include: "*"

spring:
  security:
    user:
      name: admin
      password: admin
      roles: ENDPOINT_ADMIN
```

默认情况下，health健康检查端口不会被认证拦截，如需要添加，还需要如下配置

```yaml
management:
  endpoint:
    health:
      roles: ENDPOINT_ADMIN
```

这时候就添加了认证，再次访问指标接口就需要添加Basic认证了。

```bash
curl -u admin:admin http://192.168.96.196:8081/actuator/prometheus
```

## Prometheus采集指标添加认证

我们的Prometheus采用Operator安装，所以只需要修改PodMonitor和ServiceMonitor就可以了。如果没有使用Operator可能需要修改Prometheus本身的job，可参考：https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config

### 添加一个Secret存储密码：

Secret中有两个key分别是username和password，值是对应的明文Base64后的。

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: basic-auth
  namespace: metric-yyc
data:
  password: YWRtaW4= # base64 字符串 admin
  username: YWRtaW4= 
```

### 修改ServiceMonitor：

在spec.endpoints下添加basicAuth，如下：

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  labels:
    yyc: app
  name: service-out
  namespace: metric-yyc
spec:
  endpoints:
  - interval: 10s
    path: /metrics
    port: metric
    basicAuth: # 添加认证
      password:
        name: basic-auth
        key: password
      username:
        name: basic-auth
        key: username
    relabelings:
    - action: replace
      regex: ([^:]+)(?::\d+)?;(\d+)
      replacement: $1:$2
      sourceLabels:
      - __address__
      - __meta_kubernetes_service_annotation_prometheus_io_port
      targetLabel: __address__
    - action: replace
      regex: (.*)
      replacement: $1
      sourceLabels:
      - __meta_kubernetes_service_annotation_prometheus_io_path
      targetLabel: __metrics_path__
  namespaceSelector:
    matchNames:
    - app-yyc # 需要选择的namespace
  selector:
    matchLabels:
      prometheus.io/scrape: "true"
      yyc.metric.auth: "true" # 自定义一个label用于匹配需要认证的service
```

### 修改PodMonitor：

在spec.podMetricsEndpoints下添加basicAuth，如下：

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  labels:
    yyc: app
  name: pod-out
  namespace: metric-yyc
spec:
  namespaceSelector:
    matchNames:
    - app-yyc # 需要选择的namespace
  podMetricsEndpoints:
  - interval: 15s
    path: /actuator/prometheus
    port: metric
    basicAuth: # 添加认证
      password:
        name: basic-auth
        key: password
      username:
        name: basic-auth
        key: username
    relabelings:
    - action: replace
      regex: ([^:]+)(?::\d+)?;(\d+)
      replacement: $1:$2
      sourceLabels:
      - __address__
      - __meta_kubernetes_pod_annotation_prometheus_io_port
      targetLabel: __address__
    - action: replace
      regex: (.*)
      replacement: $1
      sourceLabels:
      - __meta_kubernetes_pod_annotation_prometheus_io_path
      targetLabel: __metrics_path__
  selector:
    matchLabels:
      prometheus.io/scrape: "true"
      yyc.metric.auth: "true" # 自定义一个label用于匹配需要认证的service
```

这样Prometheus就可以在采集数据指标时自动加上Base认证了。

这里遇到一个坑就是Prometheus Operator在较低的版本中的PodMonitor不支持basicAuth字段，注意查看对应版本prometheus-operator-crd的定义[^1]。

## 参考：

1:<https://www.amitph.com/how-to-secure-spring-boot-actuator-endpoints/>

2:<https://github.com/prometheus-operator/prometheus-operator/blob/main/Documentation/user-guides/basic-auth.md>

3:<https://github.com/prometheus-operator/prometheus-operator/tree/main/example/prometheus-operator-crd>

4: Spring Boot Actuator <https://blog.csdn.net/weixin_50518271/article/details/111183826> ，<https://blog.csdn.net/weixin_50518271/article/details/111237298>
