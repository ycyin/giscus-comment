---
title: 解决Git每次push都要重新输入账号密码和HttpRequestException encountered的问题
date: 2020-03-12 11:54:58
tag:
  - Git
  - 使用技巧
category: Git
---

在Git进行多账户配置后-[（Git多用户账号配置）](https://ladybug.top/Git/git-multi-user-account-configuration---configure-SSH-key.html),最开始使用没有问题，可以实现多线push。过了几天，不知道为啥就不行了，每次提交都要重新输入账号密码。以下是我处理该问题的总结步骤：

 1、查看系统ssh-key代理,执行如下命令 <!--more-->

```shell
ssh-add -l
```

出现错误：` Could not open a connection to your authentication agent `。

2、执行命令(*注： 更多关于ssh-agent的细节，可以用 man ssh-agent 来查看* )

```shell
ssh-agent bash
```

再次查看系统ssh-key代理

出现错误：` The agent has no identities`。表示系统没有代理。

3、执行如下命令先清除代理

```shell
ssh-add -D
```

4、最后重新添加代理，将私钥添加到本地-[Git多用户账号配置](https://ladybug.top/Git/git-multi-user-account-configuration---configure-SSH-key.html) 

```shell
ssh-add ~/.ssh/id_rsa_github // 将 GitHub 私钥添加到本地
ssh-add ~/.ssh/id_rsa_coding // 将 coding 私钥添加到本地
```

5、如果是出现`fatal: HttpRequestException encountered`这个异常导致的，则需要更新Windows的git凭证管理器。官方下载地址： https://github.com/Microsoft/Git-Credential-Manager-for-Windows/releases/tag/v1.14.0 

> 参考： https://blog.csdn.net/qq_34306360/article/details/80275277 



至此，问题解决，再次提交就不会重新输入用户名和密码了。

