---
title: 解决前端请求后台接口,后台报错Can not deserialize instance of java.util.ArrayList out of START_OBJECT token
date: 2021-03-30 17:47:08
tags:
  - Java
  - 序列化
categories: 前端技术
---

## 问题重现

后台接口定义：

```java
@POST
@Path(value = "/finishOrder")
@Produces("application/json")
@Consumes("application/json")
public Result finishOrder(@HeaderParam(Const.TOKEN) String token, List<Order> orderlist,@QueryParam("hasSix") String hasSix) {
  // ... 
}
```

前端请求(简写)：

```
url: http://test.com/finishOrder
header:token:123456
method:post
request Body:
{"orderList":[{"num":"202103192374","CustomerIndex":0,"RemarkIndex":"","RemarkName":"","RemarkValue":"","Rid":"0"}],"hasSix":"N"}
```

报错：

```
org.jboss.resteasy.spi.ReaderException: org.codehaus.jackson.map.JsonMappingException: Can not deserialize instance of java.util.ArrayList out of START_OBJECT token
 at [Source: java.io.ByteArrayInputStream@730d5810; line: 1, column: 1]
        at org.jboss.resteasy.core.MessageBodyParameterInjector.inject(MessageBodyParameterInjector.java:202)
        at org.jboss.resteasy.core.MethodInjectorImpl.injectArguments(MethodInjectorImpl.java:136)
        at org.jboss.resteasy.core.MethodInjectorImpl.invoke(MethodInjectorImpl.java:159)
        at org.jboss.resteasy.core.ResourceMethod.invokeOnTarget(ResourceMethod.java:257)
        at org.jboss.resteasy.core.ResourceMethod.invoke(ResourceMethod.java:222)
        at org.jboss.resteasy.core.ResourceMethod.invoke(ResourceMethod.java:211)
        at org.jboss.resteasy.core.SynchronousDispatcher.getResponse(SynchronousDispatcher.java:542)
        at org.jboss.resteasy.core.SynchronousDispatcher.invoke(SynchronousDispatcher.java:524)
        at org.jboss.resteasy.core.SynchronousDispatcher.invoke(SynchronousDispatcher.java:126)
        at org.jboss.resteasy.plugins.server.servlet.ServletContainerDispatcher.service(ServletContainerDispatcher.java:208)
        at org.jboss.resteasy.plugins.server.servlet.HttpServletDispatcher.service(HttpServletDispatcher.java:55)
        at org.jboss.resteasy.plugins.server.servlet.HttpServletDispatcher.service(HttpServletDispatcher.java:50)
        at javax.servlet.http.HttpServlet.service(HttpServlet.java:717)
        at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:290)
        at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:206)
        at com.test.server.filter.UrlFilter.doFilter(UrlFilter.java:91)
        at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:235)
        at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:206)
        at com.test.server.filter.gzip.CompressionFilter.doFilter(CompressionFilter.java:56)
        at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:235)
        at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:206)
        at org.jboss.web.tomcat.filters.ReplyHeaderFilter.doFilter(ReplyHeaderFilter.java:96)
        at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:235)
        at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:206)
        at org.apache.catalina.core.StandardWrapperValve.invoke(StandardWrapperValve.java:235)
        at org.apache.catalina.core.StandardContextValve.invoke(StandardContextValve.java:191)
        at org.jboss.web.tomcat.security.SecurityAssociationValve.invoke(SecurityAssociationValve.java:190)
        at org.jboss.web.tomcat.security.JaccContextValve.invoke(JaccContextValve.java:92)
        at org.jboss.web.tomcat.security.SecurityContextEstablishmentValve.process(SecurityContextEstablishmentValve.java:126)
        at org.jboss.web.tomcat.security.SecurityContextEstablishmentValve.invoke(SecurityContextEstablishmentValve.java:70)
        at org.apache.catalina.core.StandardHostValve.invoke(StandardHostValve.java:127)
        at org.apache.catalina.valves.ErrorReportValve.invoke(ErrorReportValve.java:102)
        at org.jboss.web.tomcat.service.jca.CachedConnectionValve.invoke(CachedConnectionValve.java:158)
        at org.apache.catalina.core.StandardEngineValve.invoke(StandardEngineValve.java:109)
        at org.apache.catalina.connector.CoyoteAdapter.service(CoyoteAdapter.java:330)
        at org.apache.coyote.http11.Http11Processor.process(Http11Processor.java:829)
        at org.apache.coyote.http11.Http11Protocol$Http11ConnectionHandler.process(Http11Protocol.java:598)
        at org.apache.tomcat.util.net.JIoEndpoint$Worker.run(JIoEndpoint.java:447)
        at java.lang.Thread.run(Thread.java:662)
Caused by: org.codehaus.jackson.map.JsonMappingException: Can not deserialize instance of java.util.ArrayList out of START_OBJECT token
 at [Source: java.io.ByteArrayInputStream@730d5810; line: 1, column: 1]
        at org.codehaus.jackson.map.JsonMappingException.from(JsonMappingException.java:163)
        at org.codehaus.jackson.map.deser.StdDeserializationContext.mappingException(StdDeserializationContext.java:219)
        at org.codehaus.jackson.map.deser.StdDeserializationContext.mappingException(StdDeserializationContext.java:212)
        at org.codehaus.jackson.map.deser.std.CollectionDeserializer.handleNonArray(CollectionDeserializer.java:246)
        at org.codehaus.jackson.map.deser.std.CollectionDeserializer.deserialize(CollectionDeserializer.java:204)
        at org.codehaus.jackson.map.deser.std.CollectionDeserializer.deserialize(CollectionDeserializer.java:194)
        at org.codehaus.jackson.map.deser.std.CollectionDeserializer.deserialize(CollectionDeserializer.java:30)
        at org.codehaus.jackson.map.ObjectMapper._readValue(ObjectMapper.java:2704)
        at org.codehaus.jackson.map.ObjectMapper.readValue(ObjectMapper.java:1315)
        at org.codehaus.jackson.jaxrs.JacksonJsonProvider.readFrom(JacksonJsonProvider.java:419)
        at org.jboss.resteasy.core.interception.MessageBodyReaderContextImpl.proceed(MessageBodyReaderContextImpl.java:105)
        at org.jboss.resteasy.plugins.interceptors.encoding.GZIPDecodingInterceptor.read(GZIPDecodingInterceptor.java:63)
        at org.jboss.resteasy.core.interception.MessageBodyReaderContextImpl.proceed(MessageBodyReaderContextImpl.java:108)
        at org.jboss.resteasy.core.MessageBodyParameterInjector.inject(MessageBodyParameterInjector.java:169)
        ... 38 more
```

## 问题解决

主要问题出在前端请求参数有问题，当参数为List时直接传数组，而`@QueryParam`的参数需要带在Url参数后面。

前端请求(简写)：

```
url: http://test.com/finishOrder?hasSix=N
headers:token:123456
method:post
request Body:
[{"num":"202103192374","CustomerIndex":0,"RemarkIndex":"","RemarkName":"","RemarkValue":"","Rid":"0"}]
```



此时，问题解决。