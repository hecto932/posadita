import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mt-8 text-center">
      <p className="text-5xl" aria-hidden>
        🪅
      </p>
      <h1 className="mt-3 text-2xl font-extrabold">Este enlace no existe</h1>
      <p className="mt-1 text-cafe">Puede que esté incompleto o que el evento se haya eliminado.</p>
      <Link href="/" className="btn-primary mt-5">
        Ir al inicio
      </Link>
    </div>
  );
}
