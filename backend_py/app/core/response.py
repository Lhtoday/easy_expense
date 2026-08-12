from collections.abc import Callable
from fastapi import Response
from fastapi.routing import APIRoute


class ApiResponseRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request):
            response = await original_route_handler(request)
            if isinstance(response, Response):
                return response
            return {"success": True, "data": response}

        return custom_route_handler


def page_result(items: list[dict], page: int, page_size: int, total: int) -> dict:
    return {"items": items, "page": page, "pageSize": page_size, "total": total}

