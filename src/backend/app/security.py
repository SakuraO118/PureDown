import ipaddress
import socket
from urllib.parse import urlparse


class UnsafeUrlError(ValueError):
    pass


def validate_public_video_url(value: str) -> str:
    try:
        parsed = urlparse(value)
    except ValueError as exc:
        raise UnsafeUrlError("URL 格式无效") from exc
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeUrlError("仅支持公开 HTTP/HTTPS 视频地址")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("URL 不允许包含凭据")
    hostname = parsed.hostname.lower().rstrip(".")
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise UnsafeUrlError("不允许访问本机地址")
    try:
        addresses = socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeUrlError("无法解析视频地址") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise UnsafeUrlError("不允许访问内网或保留地址")
    return value
