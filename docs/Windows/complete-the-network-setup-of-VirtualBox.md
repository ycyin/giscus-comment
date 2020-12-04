---
title: 彻底搞定VirtualBox虚拟机的网络设定
tags:
  - VirtualBox
  - 虚拟机
  - 网络设置
keywords:
  - VirtualBox
  - 网络设置
  - 虚拟机网络设置
date: 2020-12-04 19:33:33
categories: Windows
description: VirtualBox虚拟机网络设置
---
## 前言

> 本文纯属自己实践所得，如有不对，勿怪~

之前在VirtualBox中配置虚拟机总会遇到连不上网的情况，然后稀里糊涂搞一通连上了 就不管了，等第二次搞又还是连不上，今天经过多次实验彻底搞定，在此记录一下，以便后面再用。

我这里使用的VirtualBox版本为：版本 6.1.12 r139181 (Qt5.6.2)

拟安装的虚拟机镜像版本为：CentOS-7-x86_64-DVD-1810.iso

宿主机系统为Win10 1909专业版

## 关于创建虚拟机

创建虚拟机时，只需要傻瓜式点下一步即可，无需配置任何东西，建议勾选动态分配空间可以节省不少的硬盘空间哦~

## 配置网络

### 第一步：配置主机网络管理器

VirtualBox主界面->管理->主机网络管理器(Ctrl+H)，点开就能看到一个Host-Only的网络适配器，选择属性，勾选DHCP服务器为启用，网卡设置为自动配置网卡。

![](./complete-the-network-setup-of-VirtualBox\network1.png)

这个网卡地址（192.168.88.103）就和你本机的这个网络（VirtualBox Host-Only Network）一致，因为这里选择的是自动配置网卡，所以我本机查看也是自动获取的，<span style="color:red">不要手动去控制面板修改这个网络的IP地址属性</span>。

![](./complete-the-network-setup-of-VirtualBox\network3.png)

也可以通过ipconfig命令查看到这个地址：重启一次电脑，不要启动VirtualBox，直接执行ipconfig命令，你就会发现系统给他分配的是一个保留地址，直到你启动虚拟机就会被更改。

![](./complete-the-network-setup-of-VirtualBox\network4.png)

然后点击DHCP服务器设置：勾选启用，服务器地址一般就填192.168.xxx.1就行。这样设置之后你在VirtualBox创建的虚拟机就会根据这个去自动分配IP地址，第一个虚拟机就默认是这里配置的最小地址（192.168.88.100），第二个是192.168.88.101依次类推。<span style="color:red">所以，一般来说我们没必要去把虚拟机启动起来然后去给它设置一个静态的IP,只需要以此类推就可以知道IP地址的(设置静态IP设置不好就会导致网络无法访问，多一事不如少一事)。</span>

![](./complete-the-network-setup-of-VirtualBox\network2.png)

### 第二步：设置每台虚拟机的网卡

我这里配置了三台虚拟机，每一台都以相同的方式配置，如下：

![](./complete-the-network-setup-of-VirtualBox\network5.png)

每一个虚拟机系统<span style="color:red">网卡1都选择Host-Only,网卡2都选择NAT。</span>如下所示：

![](./complete-the-network-setup-of-VirtualBox\network6.png)

![](./complete-the-network-setup-of-VirtualBox\network7.png)

按照网友的说法，<span style="color:red">Host-Only是用来保证宿主机与虚拟机互通和虚拟机之间互通的，而NAT网络是用来保证可访问外网的</span>。

所以这里就有一点网上很多文章没有说全：<span style="color:red">当要设置静态IP时，直接修改`/etc/sysconfig/network-scripts/ifcfg-enp0s3`这个网卡配置是不对的</span>，因为通过我的多次实验发现，我们设置静态IP是宿主机与虚拟机互通和虚拟机之间互通的IP，也就是Host-Only网卡的IP，所以直接修改`enp0s3`这个的前提是，要网卡1设置的是Host-Only（如我前面所说，不建议也没必要去设置静态IP）。<span style="color:orange">如果网卡1和网卡2设置反了，就要考虑是不是应该修改enp0s8这个配置</span>（我发现我这几个系统都没有这个文件的）。

## 查看IP验证一下

启动三台虚拟机，使用`ifconfig`命令查看IP配置，新装的系统没有这个命令，需要装一下`yum install net-tools -y` 或者使用`ip addr`命令，如下图所示：

![](./complete-the-network-setup-of-VirtualBox\network8.png)

可以发现我这里网卡1(enp0s3)设置的是Host-Only,网卡2(enp0s8)设置的是NAT。

## 总结

- 创建虚拟机时选择勾选动态分配空间可以节省不少的硬盘空间
- 不要手动的去控制面板修改VirtualBox Host-Only Network这个网络的IP，可以直接在VirtualBox中配置主机网络管理器
- 当设置静态IP（不建议）需要确定对应设置的Host-Only网卡是哪个一个
- 使用ip addr可以查看IP配置信息，也可以通过`yum install net-tools -y`命令安装后使用ifconfig`命令查看。