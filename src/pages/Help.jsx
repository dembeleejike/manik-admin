import React from "react";
import Layout from "../components/Layout";
import { PageHeader } from "../components/ui";
import { C } from "../tokens";
import { useAuth } from "../AuthContext";

function Topic({ title, children, open }) {
  return (
    <details open={open} className="mb-3" style={{ background: C.cream, border: `1px solid ${C.ink}1A` }}>
      <summary className="px-5 py-3 text-sm font-semibold cursor-pointer" style={{ color: C.ink }}>{title}</summary>
      <div className="px-5 pb-4 text-sm leading-relaxed space-y-2" style={{ color: "#54524C" }}>{children}</div>
    </details>
  );
}

export default function Help() {
  const { admin } = useAuth();
  const isOwner = admin?.role === "owner";
  return (
    <Layout>
      <PageHeader title="Help — How to use this dashboard" />

      <Topic title="Your daily routine" open>
        <p><strong>1. Bought new stock?</strong> Go to <em>Purchases</em> and record it. Stock goes up by itself.</p>
        <p><strong>2. Sold something?</strong> Go to <em>Sales</em> and record it. Stock goes down by itself, the customer is saved, and you can print the receipt or send it on WhatsApp.</p>
        {isOwner && <p><strong>3. Spent money on running the shop?</strong> (transport, electricity, staff…) record it in <em>Expenses</em>. Don't record stock purchases there — use Purchases.</p>}
        <p><strong>{isOwner ? "4" : "3"}. Someone asked for a price on the website?</strong> It appears in <em>Quote requests</em>. Call or WhatsApp them, mark it Contacted, and tap "Convert to sale" if they buy.</p>
      </Topic>

      <Topic title="Quotations, invoices and receipts (PDF)">
        <p>Go to <em>Quotations</em> → <em>New quotation</em>. Pick products from stock (the price fills in) or type a service, add a discount and a valid-until date, then download the <strong>PDF</strong>, <strong>share</strong> it, or send it on <strong>WhatsApp</strong>.</p>
        <p>When the customer accepts, press <strong>Convert to sales</strong>: stock items become real sales and stock goes down. Enter a deposit if they paid something.</p>
        <p>Every sale also has an invoice PDF and, once something is paid, a receipt PDF.</p>
      </Topic>

      <Topic title="Customers who pay later">
        <p>On a sale that isn't fully paid, press <strong>Record payment</strong>. It can never go past the amount owed.{isOwner ? " If you record one by mistake, press “undo” under it." : ""}</p>
        <p>{isOwner ? "Open a customer to download their account statement (all charges, payments and the running balance) or send a polite payment reminder on WhatsApp. " : ""}The Overview page lists who owes the most.</p>
      </Topic>

      <Topic title="Stock count">
        <p>Open <em>Stock count</em>, type what you actually counted for each product, and press <strong>Review &amp; save</strong>. You'll see every difference before confirming. Quantities are then set to your counts and the difference is recorded permanently under History.</p>
      </Topic>

      <Topic title="Product and project photos">
        <p>Up to 8 photos per product and 12 per project. Big phone photos are shrunk automatically. Press the red ✕ on a photo to remove it.</p>
      </Topic>

      <Topic title="Searching, filtering and sorting">
        <p>Every list page has a search bar. Type several words and it finds records that match <em>all</em> of them — for example <em>"john window"</em> finds John's window sales, and <em>"october"</em> or <em>"2026-10"</em> finds that month.</p>
        <p>Combine it with the date menu (Today, This week, This month, This year, Last 30 days, a month you pick, or your own dates), the dropdowns (category, product, payment status, supplier…) and the Sort menu. "Clear filters" resets everything.</p>
        <p>The list always tells you "Showing X of Y", and on Sales, Purchases and Expenses the total of what's showing.</p>
      </Topic>

      <Topic title="Exporting and sharing">
        <p>Above every list there are <strong>Excel</strong>, <strong>CSV</strong> and (on phones) <strong>Share</strong> buttons. They export exactly what you're looking at — so filter first (say, "October" + "Unpaid") and then export just that.</p>
        <p>Sales can be sent to a customer as a WhatsApp receipt with one tap.</p>
        {isOwner && <p>For everything at once, use <em>Business Settings → Backup, restore &amp; spreadsheets</em>.</p>}
      </Topic>

      {isOwner && (
        <Topic title="Backup and restore">
          <p>A full backup is made automatically every night: it is stored privately online and emailed to the owner (a .json file for restoring, and an Excel copy for reading).</p>
          <p>In <em>Business Settings</em> you can also <strong>download a backup</strong> or <strong>email one</strong>: type the email address to send it to and your password to confirm it's you. The nightly backup goes to every owner account's email.</p>
          <p><strong>To restore:</strong> choose a backup .json file. You'll see exactly how many records will be updated or brought back, and nothing happens until you tick the box and press Restore. A restore never deletes anything you added after the backup, and a safety copy of your current data is emailed first. Logins (admins and passwords) are never part of backups.</p>
        </Topic>
      )}

      <Topic title="Owner and staff accounts">
        <p><strong>Owner</strong> accounts see everything: reports, expenses, customers, what the shop paid for stock (cost prices), settings, the activity log, and can delete records. <strong>Staff</strong> accounts can handle products, quotations, sales, purchases, stock counts and projects, but never see cost prices or profit, and can't delete sales or purchases.</p>
        {isOwner && <p>Add or remove logins in <em>Admins</em>. People sign in with an email address or a phone number. Everyone can change their own password from the sidebar.</p>}
      </Topic>

      <Topic title="Privacy and your data">
        <p>Customer names and phone numbers are used only to keep sales history and to let you contact them. The website never shows cost prices or stock counts to visitors.</p>
        <p>Backups are stored privately (not on a public link). Anyone who receives a backup file or spreadsheet can read your customers and money records, so don't forward them or leave them on shared computers.</p>
        {isOwner && <p>The <em>Activity log</em> records who deleted or changed important things. It deliberately doesn't store phone numbers or passwords.</p>}
      </Topic>

      <Topic title="If something looks wrong">
        <p>A stock number is off? Check <em>Purchases</em> and <em>Sales</em> for a missing or doubled entry — deleting a wrong entry puts the stock back. You can also correct the quantity directly by editing the product.</p>
        <p>Can't sign in? Check the email or phone number, then ask an owner to add a new login. Too many wrong attempts will pause logins for a few minutes.</p>
      </Topic>
    </Layout>
  );
}
