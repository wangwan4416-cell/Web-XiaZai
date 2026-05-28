import asyncio
from typing import Callable, Awaitable, TypeVar

T = TypeVar("T")


async def retry(
    fn: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    delays: tuple = (1, 2, 3),
) -> T:
    """Retry an async function on failure with progressive delays."""
    last_err = None
    for i in range(max_retries + 1):
        try:
            return await fn()
        except Exception as e:
            last_err = e
            if i < max_retries:
                await asyncio.sleep(delays[min(i, len(delays) - 1)])
    raise last_err  # type: ignore
