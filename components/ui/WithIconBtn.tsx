export default function WithIconBtn({
  children,
  btnColor,
  textColor,
  className
}: Readonly<{
  children: React.ReactNode;
  btnColor?: string;
  textColor?: string;
  className?: string;
}>) {
  return (
    <div className={`flex gap-2 items-center justify-center col-span-2 p-10 py-4 rounded-md shadow-sm text-lg
      ${btnColor ? btnColor : "bg-neutral-700"}
      ${textColor ? textColor : "text-white"}
      ${className}`}>
      {children}
    </div>
  );
}
