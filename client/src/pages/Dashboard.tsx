import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Users, 
  ShoppingBag, 
  Tags,
  MoreHorizontal
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const stats = [
  {
    title: "Total Sales",
    value: "R$ 145.231,89",
    change: "+20.1% vs last month",
    trend: "up",
    icon: DollarSign,
  },
  {
    title: "Avg. Order Value",
    value: "R$ 450,00",
    change: "+12.5% vs last month",
    trend: "up",
    icon: Tags,
  },
  {
    title: "Total Orders",
    value: "324",
    change: "+19% vs last month",
    trend: "up",
    icon: ShoppingBag,
  },
  {
    title: "New VIP Clients",
    value: "+12",
    change: "+4 this week",
    trend: "up",
    icon: Users,
  },
];

const data = [
  { name: "Mon", total: 4200 },
  { name: "Tue", total: 3100 },
  { name: "Wed", total: 5800 },
  { name: "Thu", total: 4400 },
  { name: "Fri", total: 8800 },
  { name: "Sat", total: 12500 },
  { name: "Sun", total: 9500 },
];

const recentSales = [
  {
    name: "Ana Silva",
    email: "ana.silva@email.com",
    item: "Summer Floral Dress",
    amount: "R$ 299,00",
    avatar: "AS",
  },
  {
    name: "Juliana Costa",
    email: "ju.costa@email.com",
    item: "Leather Crossbody Bag",
    amount: "R$ 450,00",
    avatar: "JC",
  },
  {
    name: "Mariana Santos",
    email: "mari.santos@email.com",
    item: "Denim Jacket Vintage",
    amount: "R$ 380,00",
    avatar: "MS",
  },
  {
    name: "Carolina Oliveira",
    email: "carol.oli@email.com",
    item: "Silk Scarf Pattern",
    amount: "R$ 120,00",
    avatar: "CO",
  },
  {
    name: "Fernanda Lima",
    email: "fe.lima@email.com",
    item: "Linen Trousers Beige",
    amount: "R$ 259,00",
    avatar: "FL",
  },
];

export default function Dashboard() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fashion Retail Overview</h1>
            <p className="text-muted-foreground">Store performance for Spring Collection 2025</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">Download Report</Button>
            <Button size="sm">New Order</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-rose-500" />
                  )}
                  <span className={stat.trend === "up" ? "text-emerald-500" : "text-rose-500"}>
                    {stat.change}
                  </span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Weekly Sales Revenue</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))", 
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }} 
                    />
                    <Bar
                      dataKey="total" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent Purchases</CardTitle>
              <CardDescription>
                Live feed of in-store and online sales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {recentSales.map((sale, index) => (
                  <div key={index} className="flex items-center">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{sale.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{sale.name}</p>
                      <p className="text-sm text-muted-foreground truncate w-[140px]">
                        {sale.item}
                      </p>
                    </div>
                    <div className="ml-auto font-medium">{sale.amount}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
