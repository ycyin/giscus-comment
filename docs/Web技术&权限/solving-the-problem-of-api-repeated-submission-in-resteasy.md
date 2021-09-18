---
title: 在RestEasy2.x中解决接口重复提交问题
date: 2021-09-17 13:18:25
tags:
  - resteasy
  - 重复提交
categories: Web技术&权限
---

## 前言

解决此问题的初衷在于生产上的一个保存接口问题，这个接口逻辑比较多耗时长，大约在30s左右。前端做了当前页面按钮的重复点击限制，但是由于接口耗时太长点击按钮后一直在加载中，可能用户就等不及了页面返回了上一步操作，然后又进入这个页面进行保存操作，这样用户多次点击了保存按钮。这就造成了第一次请求还未处理完就又有相同的第二次请求甚至多次请求，导致接口中某个环节数据处理异常。需要解决的问题就是要让第一次请求还没处理完成时不允许第二次请求！

## 解决方案

通过在网上寻找解决方案，最终发现以下几种解决方式：

1.加锁 （是最简单的实现方式，但是性能堪忧，而且会阻塞请求）

2.请求拦截 （可以共用，但是怎么去实现却是一个问题，怎么用一个优雅的方式实现，并且方便复用）

3.修改实现，直接在对应接口上面改动 （会对原有代码做改动，存在风险，最主要的是不能共用）

显然，只有第二种方式最合适，但是怎么去实现呢？

最简单的方式就是使用Spring AOP实现，可以参考文末参考链接中的第二个。但是我们项目中是使用的RESTEasy，还是比较老的版本，通过查阅官方文档（文末参考链接第一个），可以使用RESTEasy提供的拦截器实现。

## 代码实现

**定义拦截器处理：**

分别实现PreProcessInterceptor和MessageBodyWriterInterceptor接口的preProcess和write方法分别处理请求进入和请求返回。在preProcess方法中拦截到请求进入，将这个请求的唯一标识（我这里是用户的Token+URL）加入到ConcurrentSkipListSet中，加入失败就代表这个请求还在处理中没有返回，这时直接返回DUPLICATE_ERROR_MSG；拦截请求返回，这里需要特殊处理一下刚刚拦截的DUPLICATE_ERROR_MSG返回，如果不是拦截的返回就将ConcurrentSkipListSet中的那一条数据删除，代表这个请求已经处理完成了。

另外如果ConcurrentSkipListSet中的数据在某些失败的情况下（测试发现request status = 400时就会这样）没有进入write方法进行KEY.remove()，就会导致Set无限增长，所以这里定义了一个定时器，第一次延迟8小时，每24小时清空一次Set。

```java
import org.apache.commons.collections.ListUtils;
import org.apache.commons.lang.StringUtils;
import org.jboss.resteasy.annotations.interception.ServerInterceptor;
import org.jboss.resteasy.core.*;
import org.jboss.resteasy.spi.Failure;
import org.jboss.resteasy.spi.HttpRequest;
import org.jboss.resteasy.spi.interception.*;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

/**
 * @author yyc
 * @Classname DuplicateSubmitInterceptor
 * @Description 使用拦截器解决重复提交问题
 * 旨在解决前一个请求还在执行，后一个相同请求又进来的问题
 * @Date 2021/9/6/0006 13:53
 */
@Provider
@ServerInterceptor
public class DuplicateSubmitInterceptor implements PreProcessInterceptor, MessageBodyWriterInterceptor {
    private static final Set<String> KEY = new ConcurrentSkipListSet<String>();
    private static String DUPLICATE_ERROR_MSG = "duplicate-submit";
    private static String TOKEN = "XXXX-TOKEN";
    private static String PREPROCESSEDPATH = "XXXX-PREPROCESSEDPATH";
    private static List<String> DUPLICATE_URLS = new ArrayList<String>(){{
        add("/xxx/saveXXXX");
    }};

    static{
        ScheduledExecutorService scheduled = new ScheduledThreadPoolExecutor(1);
        scheduled.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                // task to run goes here
                logger.warn("duplicate-submit KEY遗留数据 "+ KEY.size() + "条,准备清空！");
                KEY.clear();
            }
        },8, 24, TimeUnit.HOURS);
    }


    @Override
    public ServerResponse preProcess(HttpRequest httpRequest, ResourceMethod resourceMethod) throws Failure, WebApplicationException {
        List<String> tokenList = httpRequest.getHttpHeaders().getRequestHeader(TOKEN);
        String preprocessedPath = httpRequest.getPreprocessedPath();
        String token = null;
        if (tokenList != null && tokenList.size() > 0) {
            token = tokenList.get(0);
        }
        if (StringUtils.isNotEmpty(token) && StringUtils.isNotEmpty(preprocessedPath)
                && DUPLICATE_URLS.contains(preprocessedPath) && !"null".equalsIgnoreCase(token)) {
            httpRequest.setAttribute(PREPROCESSEDPATH,preprocessedPath);
            httpRequest.setAttribute(TOKEN,token);
            if(!KEY.add(token + preprocessedPath)){
                ServerResponse serverResponse = new ServerResponse();
                serverResponse.setEntity(DUPLICATE_ERROR_MSG);
                return serverResponse;
            }
        }
        return null;
    }

    @Override
    public void write(MessageBodyWriterContext messageBodyWriterContext) throws IOException, WebApplicationException {
        String token = (String) messageBodyWriterContext.getAttribute(TOKEN);
        String preprocessedPath = (String) messageBodyWriterContext.getAttribute(PREPROCESSEDPATH);
        Object entity = messageBodyWriterContext.getEntity();
        if (DUPLICATE_URLS.contains(preprocessedPath) &&
                entity instanceof String && !DUPLICATE_ERROR_MSG.equals(entity)){
            KEY.remove(token + preprocessedPath);
        }
        messageBodyWriterContext.proceed();
    }
}
```

**注册拦截器：**

在web.xml中注册：

```xml
    <context-param>
	    <param-name>resteasy.providers</param-name>
	    <param-value>com.yyc.interceptor.ResteasyInterceptor</param-value>
	</context-param>
```

## 存在的问题

以上处理方案还存在诸多问题：

1. 由于我们是将接口的唯一信息放在Set中的，如果是分布式部署在多台机器上的系统就会存在问题；
2. 在某些情况下没有进入write方法进行KEY.remove()，比如前面说到的请求状态为400时，就会导致这一个接口一直提示duplicate-submit。

## 参考

- 官方文档：[RESTEasy JAX-RS (jboss.org)](https://docs.jboss.org/resteasy/docs/2.3.5.Final/userguide/html_single/index.html#PostProcessInterceptors)[RESTEasy JAX-RS (jboss.org)](https://docs.jboss.org/resteasy/docs/2.3.5.Final/userguide/html_single/index.html#PostProcessInterceptors)
- [java并发访问重复请求过滤问题_java_脚本之家 (jb51.net)](https://www.jb51.net/article/140908.htm)
- [防止数据重复提交的6种方法(超简单)！ - Java中文社群 - 博客园 (cnblogs.com)](https://www.cnblogs.com/vipstone/p/13328386.html)
- [定时任务ScheduledThreadPoolExecutor的使用详解_wenzhi的博客-CSDN博客_scheduledthreadpoolexecutor](https://blog.csdn.net/wenzhi20102321/article/details/78681379)
- [多线程-并发容器ConcurrentHashMap、ConcurrentSkipListMap、ConcurrentSkipListSet_Ming339456的博客-CSDN博客](https://blog.csdn.net/qq_42709262/article/details/89000488)

