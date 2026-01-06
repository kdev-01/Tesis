import time
import psutil
import os
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("uvicorn")

class ResourceMonitorMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        process = psutil.Process(os.getpid())
        cpu_count = psutil.cpu_count(logical=True) or 1
        
        mem_before = process.memory_info().rss
        cpu_start = process.cpu_times()
        time_start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as e:
            raise e
        finally:
            time_end = time.perf_counter()
            cpu_end = process.cpu_times()
            mem_after = process.memory_info().rss
            
            execution_time = time_end - time_start
            cpu_used_seconds = (cpu_end.user - cpu_start.user) + (cpu_end.system - cpu_start.system)
            
            if execution_time > 0:
                cpu_percent = (cpu_used_seconds / (execution_time * cpu_count)) * 100
            else:
                cpu_percent = 0.0

            mem_diff_mb = (mem_after - mem_before) / (1024 * 1024)
            
            path = request.url.path
            method = request.method

            log_message = (
                f"\nMONITOR - {method} {path}\n"
                f"Tiempo: {execution_time:.4f} s\n"
                f"CPU: {cpu_percent:.2f} %\n"
                f"RAM: {mem_diff_mb:.4f} MB\n"
                f"----------------------------------------"
            )
            logger.info(log_message)

        return response
