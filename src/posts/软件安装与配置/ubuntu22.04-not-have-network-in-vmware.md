---
title: 在Vmware中Ubuntu22.04的vm-tools和网络问题
date: 2022-05-25 18:11:10
tag:
  - Vmware
  - Ubuntu
  - network
  - vm-tools
category: 软件安装&配置
---

## 前言

在Vmware pro v16.2.2中安装Ubuntu22.04出现vm-tools无法安装，且无法连接网络。

第一个问题vm-tools无法安装初步判定是Vmware 的版本对Ubuntu22.04不兼容造成的,安装open-vm-tools可以解决。

第二个问题安装好的Ubuntu22.04没有网络，是在设置静态IP后重启了宿主机出现的，初步估计也是Vmware 的版本对Ubuntu22.04不兼容造成的。

## 安装环境

- windows 10 专业版 20H2
- Vmware pro v16.2.2
- Ubuntu22.04

## vm-tools无法安装问题

不安装vm-tools最大的问题就是虚拟机的屏幕很小，无法自适应。最终通过Google解决，方案如下：

```shell
apt install open-vm-tools
apt install open-vm-tools-desktop open-vm-tools
```

重启虚拟机，验证：

```shell
lsmod | grep vmw
```

## Ubuntu22.04没有网络问题

> 网络模式为NAT模式，在`编辑-->虚拟网络编辑器-->选中NAT模式-->NAT设置`查看子网和网关。

> NetworkManager是一项后端服务，用于控制Ubuntu操作系统上的网络接口。NetworkManager的替代方法是systemd-networked。在Ubuntu桌面上，网络管理器是通过图形用户界面管理网络界面的默认服务。因此，如果要通过GUI配置IP地址，则应启用网络管理器。
>
> Ubuntu网络管理器的替代方法是systemd-networkd，这是Ubuntu服务器18.04中的默认后端服务。
>
> 因此，如果要禁用NetworkManager，则应启用网络服务，而在网络管理器运行时最好禁用网络服务。

表现为：使用ifconfig命令查看网卡只有一个`lo`网卡，使用`ip a`后显示`ens33`网卡未启动

先禁用NetworkManager启动并启用systemd-networkd：

```shell
sudo systemctl stop NetworkManager
sudo systemctl disable NetworkManager
sudo systemctl mask NetworkManager

sudo systemctl unmask systemd-networkd.service
sudo systemctl enable systemd-networkd.service
sudo systemctl start systemd-networkd.service
```

启动网卡：

```bash
ip link set ens33 up
```

使用`netplan`管理网络，新建配置文件(在/etc/netplan目录中)，文件名可自定义，注意其中的参数与之前Vmware中查看的要匹配

```shell
yyc@yyc-virtual-machine:~/Desktop$ cat /etc/netplan/01-netcfg.yaml 
# Let NetworkManager manage all devices on this system
network:
  version: 2
  renderer: networkd # 使用networkd而不是NetworkManager
  ethernets:
    ens33:
      dhcp4: no
      addresses:
        - 192.168.116.188/24 # 自定义的IP
      routes:
        - to: default
          via: 192.168.116.2 # 网关
      nameservers:
        addresses: [114.114.114.114,8.8.8.8]
```

应用设置：

```shell
sudo netplan apply
```

然后使用命令`sudo dhclient ens33 -v`验证成功

```shell
yyc@yyc-virtual-machine:~/Desktop$ sudo dhclient ens33 -v
[sudo] password for yyc: 
Internet Systems Consortium DHCP Client 4.4.1
Copyright 2004-2018 Internet Systems Consortium.
All rights reserved.
For info, please visit https://www.isc.org/software/dhcp/

Listening on LPF/ens33/00:0c:29:b1:cf:48
Sending on   LPF/ens33/00:0c:29:b1:cf:48
Sending on   Socket/fallback
DHCPDISCOVER on ens33 to 255.255.255.255 port 67 interval 3 (xid=0xf16ad521)
DHCPOFFER of 192.168.116.131 from 192.168.116.254
DHCPREQUEST for 192.168.116.131 on ens33 to 255.255.255.255 port 67 (xid=0x21d56af1)
DHCPACK of 192.168.116.131 from 192.168.116.254 (xid=0xf16ad521)
bound to 192.168.116.131 -- renewal in 763 seconds.
```

如上所示，IP是`192.168.116.131`而不是我们自己设置的`192.168.116.188`，这是Vmware的DHCP服务自动分配的IP。但是，这不影响我们直接使用自定义的IP。

使用`ifconfig`查看是使用的我们自定义的IP：

```shell
yyc@yyc-virtual-machine:~/Desktop$ ifconfig
ens33: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.116.188  netmask 255.255.255.0  broadcast 192.168.116.255
        inet6 fe80::20c:29ff:feb1:cf48  prefixlen 64  scopeid 0x20<link>
        ether 00:0c:29:b1:cf:48  txqueuelen 1000  (Ethernet)
        RX packets 160  bytes 99180 (99.1 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 177  bytes 26357 (26.3 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 139  bytes 12137 (12.1 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 139  bytes 12137 (12.1 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```


## *参考：*

[Install VMware tools on Ubuntu 20.04 Focal Fossa Linux - Linux Tutorials - Learn Linux Configuration](https://linuxconfig.org/install-vmware-tools-on-ubuntu-20-04-focal-fossa-linux)

https://computingforgeeks.com/how-to-configure-static-ip-address-on-ubuntu/

[在Ubuntu上启用和禁用NetworkManager - soso101 - 博客园 (cnblogs.com)](https://www.cnblogs.com/nuoforever/p/14176630.html)

