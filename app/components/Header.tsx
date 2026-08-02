import Image from "next/image";

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-center border-b border-zinc-200 bg-white py-2 lg:py-4">
      <Image
        src="/logo-espaco-nobile.jpg"
        alt="Espaço Nobile — móveis sob medida"
        width={420}
        height={113}
        priority
        className="h-8 w-auto lg:h-14"
      />
    </header>
  );
}
