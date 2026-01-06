import psutil
import os
import time
import functools
import logging

logger = logging.getLogger("uvicorn")

def medir_recursos(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        process = psutil.Process(os.getpid())
        cpu_count = psutil.cpu_count(logical=True) or 1 

        mem_before = process.memory_info().rss
        cpu_start = process.cpu_times()
        time_start = time.perf_counter()
        try:
            result = await func(*args, **kwargs)
        except Exception as e:
            raise e
        finally:
            time_end = time.perf_counter()
            cpu_end = process.cpu_times()
            mem_after = process.memory_info().rss
            execution_time = time_end - time_start
            
            cpu_used_seconds = (
                (cpu_end.user - cpu_start.user) +
                (cpu_end.system - cpu_start.system)
            )
            cpu_percent = (
                (cpu_used_seconds / (execution_time * cpu_count)) * 100
                if execution_time > 0 else 0.0
            )
            cpu_percent = min(cpu_percent, 100.0)

            mem_diff_mb = (mem_after - mem_before) / (1024 * 1024)

            log_message = (
                f"\nREPORT DE RECURSOS - Tarea: {func.__name__}\n"
                f"Tiempo respuesta: {execution_time:.4f} s\n"
                f"CPU Usado: {cpu_percent:.2f} %\n"
                f"RAM Usada (Delta): {mem_diff_mb:.4f} MB\n"
                f"----------------------------------------"
            )
            logger.info(log_message)

        return result

    return wrapper
