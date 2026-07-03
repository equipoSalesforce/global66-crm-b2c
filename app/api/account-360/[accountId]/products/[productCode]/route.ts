import { Account360ApiError, getAccountProductDetail } from "@/lib/account-360-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string; productCode: string }> },
) {
  const { accountId, productCode } = await params;

  try {
    const product = await getAccountProductDetail(accountId, productCode);
    return Response.json(product);
  } catch (error) {
    const status = error instanceof Account360ApiError ? error.status : 502;
    return Response.json(
      { error: "No se pudo cargar el detalle del producto." },
      { status },
    );
  }
}
