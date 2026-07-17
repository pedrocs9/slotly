import BookingClient from "./booking-client"

export default async function ReservarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <BookingClient slug={slug} />
}
