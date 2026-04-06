import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Dashboard',
  description: 'Your Godroox dashboard',
};

export default function DashboardPage() {
  return (
    <div className="container-custom py-12">
      <div className="mb-8">
        <h1 className="heading-1 text-secondary-900 mb-2">Dashboard</h1>
        <p className="body-large">Welcome to your Godroox dashboard</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Life Insurance Card */}
        <Card hover>
          <CardHeader>
            <CardTitle>Life Insurance</CardTitle>
            <CardDescription>Manage your insurance policies</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/insurance">
              <Button variant="outline" className="w-full">
                View Policies
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* LLC Card */}
        <Card hover>
          <CardHeader>
            <CardTitle>Florida LLC</CardTitle>
            <CardDescription>Track your LLC formation</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/llc">
              <Button variant="outline" className="w-full">
                View Orders
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Payments Card */}
        <Card hover>
          <CardHeader>
            <CardTitle>International Payments</CardTitle>
            <CardDescription>Send money worldwide</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/payments">
              <Button variant="outline" className="w-full">
                View Payments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/insurance/new">
              <Button className="w-full" variant="outline">
                Apply for Life Insurance
              </Button>
            </Link>
            <Link href="/dashboard/llc/new">
              <Button className="w-full" variant="outline">
                Form New LLC
              </Button>
            </Link>
            <Link href="/dashboard/payments/new">
              <Button className="w-full" variant="outline">
                Send Payment
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-secondary-600">No recent activity</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
