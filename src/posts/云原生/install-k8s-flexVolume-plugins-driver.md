---
title: 'K8s中flexvolume插件驱动的安装'
date: 2022-07-29 17:27:59
tag:
  - k8s
  - coredns
category: 云原生
description: 介绍K8s中flexvolume插件驱动的安装
---

K8s中flexvolume插件驱动的安装只需要将对应驱动文件放到对应宿主机目录下，k8s 1.17及其之前需要重启kubelet组件生效

二进制集群环境默认路径：`/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/`

Rancher集群环境默认路径：`/var/lib/kubelet/volumeplugins/<vendor~driver>/`

> Install the vendor driver on all nodes (also on master nodes if "--enable-controller-attach-detach" Kubelet option is enabled) in the plugin path. Path for installing the plugin: `<plugindir>/<vendor~driver>/<driver>`. The default plugin directory is `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/`. It can be changed in kubelet via the `--volume-plugin-dir` flag, and in controller manager via the `--flex-volume-plugin-dir` flag.
>
> For example to add a `cifs` driver, by vendor `foo` install the driver at: `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/foo~cifs/cifs`
>
> The vendor and driver names must match flexVolume.driver in the volume spec, with '~' replaced with '/'. For example, if `flexVolume.driver` is set to `foo/cifs`, then the vendor is `foo`, and driver is `cifs`.

参考：

<https://github.com/kubernetes/community/blob/master/contributors/devel/sig-storage/flexvolume.md#readme>

<https://ilovett.github.io/docs/rook/master/flexvolume.html>

<https://github.com/rancher/rancher/issues/13897>

