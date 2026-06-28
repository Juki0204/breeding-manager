export default function LinkToListBtn({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-wrap gap-1 items-center justify-center pl-2.5 pr-5.5 py-2 rounded-md border border-neutral-200 bg-white shadow-sm text-lg link-arrow">
      {children}
    </div>
  );
}
