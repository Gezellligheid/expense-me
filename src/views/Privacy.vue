<script setup lang="ts">
const lastUpdated = "July 8, 2026";
const contactEmail = "elias6503@gmail.com";
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
    <div
      class="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 sm:p-10 space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed"
    >
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
          Privacy Policy
        </h1>
        <p class="text-sm text-gray-400 mt-1">Last updated: {{ lastUpdated }}</p>
      </div>

      <p>
        Expense-me ("the app") is a personal finance tracker. This page
        explains what data we collect, why, and how it's handled — including
        the optional bank connection feature powered by
        <a
          href="https://enablebanking.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-indigo-600 dark:text-indigo-400 hover:underline"
          >Enable Banking</a
        >.
      </p>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          1. Data we collect
        </h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>
            <strong>Account info:</strong> your name, email address, and profile
            picture from Google Sign-In, used only to identify your account.
          </li>
          <li>
            <strong>Financial entries you create:</strong> expenses, incomes,
            recurring transactions, and balances you enter manually.
          </li>
          <li>
            <strong>Bank account data (only if you connect a bank):</strong>
            account details, balances, and transaction history, retrieved
            read-only via Enable Banking's regulated open banking (PSD2)
            interface.
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          2. How bank data is used — for display only
        </h2>
        <p>
          If you choose to connect a bank account, we use the Enable Banking
          API strictly to <strong>read and display</strong> your account
          balance and transaction history inside your own personal dashboard —
          the same way you'd view it in your bank's own app. Imported
          transactions are shown alongside, and behave exactly like, entries
          you add manually (in your expense/income lists, charts, and
          projections).
        </p>
        <p>We do not, and cannot, use this access to:</p>
        <ul class="list-disc pl-5 space-y-1">
          <li>Initiate payments, transfers, or any change to your account.</li>
          <li>
            See or store your online banking credentials — authentication
            happens directly on your bank's own login page; we never receive
            your password.
          </li>
          <li>Share your bank data with advertisers or data brokers.</li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          3. Where your data is stored
        </h2>
        <p>
          Your data is stored locally in your browser and synced to your
          private account on Google Firebase/Firestore, accessible only to
          you. The credential used to access your bank's data (an Enable
          Banking session reference) is stored server-side only and is never
          exposed to your browser or any third party.
        </p>
        <p>
          When generating an AI-based spending forecast, anonymized spending
          summaries and transaction descriptions may be sent to Groq (a
          third-party AI inference provider) solely to compute that forecast.
          Your bank credentials and account identifiers are never sent to
          Groq.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          4. Your control over the data
        </h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>
            Disconnect your bank at any time from Settings — this immediately
            revokes Enable Banking's access to your account.
          </li>
          <li>Export all your data as a JSON backup at any time.</li>
          <li>Permanently delete all stored data at any time.</li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          5. Data sharing
        </h2>
        <p>
          We do not sell your personal or financial data. Data is only shared
          with the service providers required to run the app: Google
          Firebase (account storage), Enable Banking (bank connectivity, only
          if you opt in), and Groq (AI forecasts, using non-identifying
          summaries only).
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          6. Contact
        </h2>
        <p>
          Questions about this policy or your data? Contact us at
          <a
            :href="`mailto:${contactEmail}`"
            class="text-indigo-600 dark:text-indigo-400 hover:underline"
            >{{ contactEmail }}</a
          >.
        </p>
      </section>

      <p class="text-xs text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
        This policy may be updated from time to time; changes will be posted
        on this page.
      </p>
    </div>
  </div>
</template>
