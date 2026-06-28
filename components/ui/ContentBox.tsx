export default function ContentBox({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="p-4 rounded-md border border-neutral-200 shadow-sm bg-white">
      {children}
    </div>
  );
}
