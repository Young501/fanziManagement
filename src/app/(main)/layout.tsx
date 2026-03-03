import { AdminLayout } from "@/components/layout/AdminLayout";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AdminLayout>{children}</AdminLayout>;
}
