"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, Pencil, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserDetailsByRFID, updateRFIDBalance } from "@/api/api";

const formSchema = z.object({
  rfid: z.string(),
  balance: z.union([z.string(), z.number()]).optional(),
  topup: z.string().optional(),
  name: z.string(),
  role: z.string(),
  address: z.string(),
  birthdate: z.string(),
  contact: z.union([z.string(), z.number()]),
  paymentMethod: z.string(),
  rfidExpiry: z.string(),
});

// 2. Component
const ReloadRFID = () => {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      role: "",
      address: "",
      birthdate: "",
      contact: "",
      rfid: "",
      balance: "",
      topup: "",
      paymentMethod: "",
      rfidExpiry: "",
    },
  });

  const onSubmit = async (values: any) => {
    const { rfid, balance, topup } = values;

    const topupAmount = parseFloat(topup);
    const currentBalance = parseFloat(balance);

    if (isNaN(topupAmount) || topupAmount <= 0) {
      alert("Enter a valid top-up amount");
      return;
    }

    const success = await updateRFIDBalance(rfid, topupAmount);

    if (success) {
      alert("Balance updated successfully!");

      form.setValue("balance", (currentBalance + topupAmount).toFixed(2));
      form.setValue("topup", "");

      // Or: await handleSearch(rfid); // if you want to re-fetch
    } else {
      alert("Failed to update balance.");
    }
  };

  const handleSearch = async (rfid: string) => {
    if (!rfid) return;

    const userData = await getUserDetailsByRFID(rfid);
    if (userData) {
      console.log("User found:", userData);

      form.reset({
        rfid: userData.rfid_number,
        balance: userData.rfid_balance,
        topup: "",
        name: userData.fullname,
        role: userData.role,
        address: userData.address,
        birthdate: userData.birthdate,
        contact: userData.phone,
        paymentMethod: userData.payment,
        rfidExpiry: userData.expiry_rfid,
      });
    } else {
      alert("No user found with that RFID");
    }
  };

  return (
    <div className="bg-white ml-24 flex items-center justify-center">
      <Card className="p-6">
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">RFID Loading</h2>
                <Pencil size={18} className="text-blue-500" />
              </div>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rfid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RFID Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                placeholder="XXXX-XXXX-XXXX"
                                className="pr-10"
                                {...field}
                              />
                              <Button
                                type="button"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2"
                                variant="ghost"
                                onClick={() =>
                                  handleSearch(form.getValues("rfid"))
                                }
                              >
                                <Search className="w-4 h-4" />
                              </Button>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="balance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Balance</FormLabel>
                          <FormControl>
                            <Input
                              disabled
                              placeholder="100.00"
                              {...field}
                              readOnly
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="topup"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Top-up Amount</FormLabel>
                          <FormControl>
                            <Input placeholder="" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Client Name"
                              {...field}
                              readOnly
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <Input placeholder="Customer" {...field} readOnly />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Customer Address"
                              {...field}
                              readOnly
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="birthdate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Birthdate</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} readOnly />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Cellphone #"
                              {...field}
                              readOnly
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Card">Card</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rfidExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RFID Expiry</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} readOnly />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="mt-4">
                    Submit
                  </Button>
                </form>
              </Form>
            </div>

            <div className="flex justify-center items-start">
              <div className="flex flex-col items-center">
                <Avatar>
                  <AvatarFallback>AL</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold mt-2">Your Name</h3>
                <p className="text-sm text-gray-500">Admin</p>
                <div className="flex gap-2 mt-2">
                  <Button size="icon" variant="outline">
                    <Mail />
                  </Button>
                  <Button size="icon" variant="outline">
                    <Phone />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReloadRFID;
