---
title: Git配置SSH Key（Git配置多个账户）
date: 2019-12-25 18:51:55
tags:
  - Git
  - 使用技巧
categories: Git
---

##  前言

一般地，都会安装好Git后直接设置一个全局的config信息，如下：

```shell
git config --global user.name "yyc" // 配置全局用户名，如 Github 上注册的用户名
git config --global user.email "34782655@qq.com" // 配置全局邮箱，如 Github 上配置的邮箱
```

但是有时候会遇到这样的问题：

场景一：将同一个项目托管在多个平台（Coding、GitHub、GitLab等）时，可能无法满足需求，因为这两个平台不仅仓库地址不一样，并且账户名和密码都是不同的。<!--more-->例如，我在github pages上面搭建的个人博客，在国内访问太慢，我需要将这个项目同时托管到Coding上，然后双线部署到coding和github pages上。

场景 二：本地有两个项目，分别使用不同的托管平台。比如项目一使用GitHub托管，项目二使用GitLab托管。

本文配置GitHub一个账户，多个账户的配置方法相同。

## 配置SSH Key

### 清除全局配置

 在正式配置之前，我们先得把全局配置给清除掉（如果你配置过的话），执行以下命令可以列出所有已经配置的全局配置 ： 

```shell
git config --global --list
```

<img :src="$withBase('/Git/git-multi-user-account-configuration---configure-SSH-key/img-1.png')" alt="全局配置信息">

 发现其中有 `user.name` 和 `user.email` 信息，请执行以下命令将其清除掉： 

```shell
git config --global --unset user.name
git config --global --unset user.email
```

### 生成密钥对

钥对的保存位置默认在 `~/.ssh` 目录（Windows 10系统在C盘User文件夹）下，我们先清理下这个目录中已存在的钥对信息，即删除其中的 `id_rsa`、`id_rsa.pub` 之类的公钥和密钥文件。<span style="color:blue">注意：windows应该切换到~/.ssh/目录下执行。</span>

首先我们开始生成 github 上的仓库钥对，通过 `-C` 参数填写 github 的邮箱：		

```shell
ssh-keygen -t rsa -C “34782655@qq.com”
```

回车后会提示`Enter file in which to save the key `，在这里输入公钥的名字(默认为 `id_rsa`)，这里输入 `id_rsa_github`。输入完毕后，一路回车，钥对就生成完毕了。<span style="color:red">注意：需要配置多个账户的话，一定要自己输入名字，以免被覆盖</span>

回车后系统将提示您输入密码以保护您的新 SSH 密钥对。最好使用密码，但也可以不需要密码，一般就按两次回车来跳过创建密码。

### 添加 SSH Keys

将 `id_rsa_github.pub` 中的内容添加到 github的 SSH Keys 中，这个需要直接到网页上设置里面操作（点头像-->setting）。可以使用命令先将文件中的内容复制到粘贴板：

```shell
cat ~/.ssh/id_rsa_github.pub | clip
```

### 添加私钥

在上一步中，我们已经将公钥添加到了 github服务器上，我们还需要将私钥添加到本地中，不然无法使用。添加命令也十分简单，如下： 

```shell
ssh-add ~/.ssh/id_rsa_github
```

添加完毕后，可以通过执行 `ssh-add -l` 命令验证下。 

执行ssh-add时出现`Could not open a connection to your authentication agent`，则应先执行如下命令即可： 

```shell
eval $(ssh-agent -s)
```

或者

```shell
ssh-agent bash
```

 更多关于ssh-agent的细节，可以用 man ssh-agent 来查看 。

### 管理密钥

通过以上步骤，公钥、密钥分别被添加到 git 服务器和本地了。下面我们需要在本地创建一个密钥配置文件，通过该文件，实现根据仓库的 remote 链接地址自动选择合适的私钥。

编辑 `~/.ssh` 目录下的 `config` 文件，如果没有，请创建。

 配置内容如下： 

```shell
Host github
HostName github.com
User yyc007
IdentityFile ~/.ssh/id_rsa_github

Host coding
HostName e.coding.net
User yyc007
IdentityFile ~/.ssh/id_rsa_coding

```

该文件分为多个用户配置，每个用户配置包含以下几个配置项：

- **Host**：仓库网站的别名，随意取
- **HostName**：仓库网站的域名（PS：IP 地址应该也可以）
- **User**：仓库网站上的用户名
- **IdentityFile**：私钥的绝对路径

 可以用 `ssh -T` 命令检测下多个仓库配置的 Host或HostName 是否是连通的： 

```shell
ssh -T git@github
```

或者

```shell
ssh -T git@github.com
```

完成以上配置后，已经基本完成了所有配置。分别进入附属于 github 和 coding的仓库，此时都可以进行 git 操作 （或者可以对同一个项目分别操作两个不同的远程Git仓库）。

## 为仓库单独配置用户名信息

完成以上配置后，其实已经基本完成了所有配置。但是如果你此时提交仓库修改后，你会发现提交的用户名变成了你的系统主机名。

这是因为 git 的配置分为三级别，System —> Global —>Local。System 即系统级别，Global 为配置的全局，Local 为仓库级别，优先级是 Local > Global > System。

因为我们并没有给仓库配置用户名，又在一开始清除了全局的用户名，因此此时你提交的话，就会使用 System 级别的用户名，也就是你的系统主机名了。

因此我们需要为每个仓库单独配置用户名信息，假设我们要配置 github 的某个仓库，进入该仓库后，执行：

```shell
git config --local user.name "yyc"
git config --local user.email "34782655@qq.com"
```

执行完毕后，通过以下命令查看本仓库的所有配置信息： 

```shell
git config --local --list
```

至此你已经配置好了 Local 级别的配置了，此时提交该仓库的代码，提交用户名就是你设置的 Local 级别的用户名了。 
