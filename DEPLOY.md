# PureDown 部署操作指南

## 前提条件

- 一台 Linux VPS（Ubuntu 20.04+ / Debian 11+ / CentOS 8+）
- 有 SSH 和 sudo 权限
- （可选）域名 + DNS 解析到 VPS IP

## 第一步：安装 Docker

```bash
# 官方一键安装脚本（推荐）
curl -fsSL https://get.docker.com | sudo sh

# 启动 Docker 并设置开机自启
sudo systemctl enable docker --now

# 把当前用户加入 docker 组（之后不用每次 sudo）
sudo usermod -aG docker $USER
# 退出 SSH 重新登录使生效
exit
```

```bash
# 重新登录后验证
docker --version
docker compose version
```

## 第二步：克隆项目

```bash
git clone https://github.com/SakuraO118/SakuraDown.git
cd SakuraDown
```

## 第三步：配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env（根据你的情况修改）
nano .env
```

**代理配置**（国内 VPS 访问 YouTube 需要）：
- 如果 VPS 上有 clash/v2ray 等代理客户端，取消注释 `HTTP_PROXY` 和 `HTTPS_PROXY`
- 代理地址示例：本机 clash 用 `http://host.docker.internal:7890`，同机 clash 用 `http://172.17.0.1:7890`

**如果暂时没有代理**，可以先用 Bilibili 测试，不需要配置代理。

## 第四步：构建并启动

```bash
# 构建镜像（首次或代码更新后执行）
docker compose build

# 启动（-d 表示后台运行）
docker compose up -d

# 查看日志确认启动成功
docker compose logs -f
# 看到 "Server running at http://localhost:3001" 即可 Ctrl+C 退出
```

访问：`http://你的VPS的IP:3001`

## 日常操作

### 更新代码

```bash
cd ~/SakuraDown
git pull
docker compose build
docker compose up -d
```

### 查看日志

```bash
docker compose logs -f --tail=100   # 实时日志
docker compose logs --tail=50       # 最近 50 行
```

### 重启服务

```bash
docker compose restart
```

### 停止服务

```bash
docker compose down
```

### 查看下载文件

下载的文件在容器内的 `/data/downloads`，通过 volume 映射到宿主机的 `./downloads` 目录：

```bash
ls -la ~/SakuraDown/downloads/
```

## 防火墙设置

如果 VPS 有防火墙（ufw/iptables/云安全组），需要放行 3001 端口：

```bash
# ufw
sudo ufw allow 3001

# 云服务商（阿里云/腾讯云等）在控制台安全组中添加 3001 端口的入站规则
```

## 常见问题

### `yt-dlp: command not found`
Docker 镜像内置了 yt-dlp，不应该出现这个错误。如果出现，重新构建镜像：
```bash
docker compose build --no-cache
```

### 下载 YouTube 超时
需要配置代理。编辑 `.env`，取消注释代理配置后重新构建：
```bash
docker compose down
docker compose up -d
```

### 端口被占用
```bash
# 查看 3001 端口是谁在用
sudo lsof -i :3001
# 换成其他端口：修改 docker-compose.yml 中 ports 行的左边部分
# "3002:3001" 表示用 3002 端口访问
```

### 磁盘空间不足
下载文件占用空间，定期清理：
```bash
# 查看下载目录大小
du -sh ~/SakuraDown/downloads/
# 删除旧文件
rm -rf ~/SakuraDown/downloads/*
```

## 下一步（TODO）

部署成功后，后续可以增加：
1. **Nginx 反代 + HTTPS**：绑定域名、配置 SSL 证书
2. **Token 认证**：加登录保护，防止滥用
3. **任务持久化**：SQLite 存储，重启不丢任务
