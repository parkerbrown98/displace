import { http, HttpResponse } from "msw";
import { placeContractFixture } from "@/features/places/place-contract";

export const handlers = [
  http.get("http://localhost:3001/api/v1/places/game-makers", () =>
    HttpResponse.json(placeContractFixture, {
      headers: { "X-Request-Id": "fixture-request-id" },
    }),
  ),
];