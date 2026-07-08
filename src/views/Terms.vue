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
          Terms of Use
        </h1>
        <p class="text-sm text-gray-400 mt-1">Last updated: {{ lastUpdated }}</p>
      </div>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          1. The service
        </h2>
        <p>
          Expense-me ("the app") is a personal finance tracker for recording
          income and expenses, planning recurring transactions, and viewing
          projections. It is provided free of charge and "as is."
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          2. Bank connection (read-only)
        </h2>
        <p>
          The app optionally lets you connect a bank account through Enable
          Banking, a regulated open banking (PSD2) provider. This access is
          strictly <strong>read-only</strong> — used only to display your
          balance and transaction history inside the app, and to import
          transactions into your own expense/income records. The app never
          initiates payments or transfers, and never receives or stores your
          bank login credentials. You can revoke this access at any time from
          Settings.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          3. Not financial advice
        </h2>
        <p>
          Projections, forecasts, and any AI-generated estimates are provided
          for general informational purposes only and are not financial
          advice. You are responsible for your own financial decisions.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          4. Your responsibilities
        </h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>Keep your Google account credentials secure.</li>
          <li>
            Only connect bank accounts that belong to you, or that you are
            otherwise authorized to connect.
          </li>
          <li>Use the app lawfully and not attempt to disrupt or misuse it.</li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          5. No warranty, limitation of liability
        </h2>
        <p>
          The app is provided without warranties of any kind. To the maximum
          extent permitted by law, we are not liable for any indirect,
          incidental, or consequential damages arising from your use of the
          app, including reliance on any projection or imported transaction
          data.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          6. Termination
        </h2>
        <p>
          You may stop using the app and permanently delete your data at any
          time from Settings. We may suspend or discontinue the service at
          any time.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          7. Changes to these terms
        </h2>
        <p>
          We may update these terms from time to time; continued use of the
          app after changes are posted constitutes acceptance of the updated
          terms.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">
          8. Contact
        </h2>
        <p>
          Questions about these terms? Contact us at
          <a
            :href="`mailto:${contactEmail}`"
            class="text-indigo-600 dark:text-indigo-400 hover:underline"
            >{{ contactEmail }}</a
          >.
        </p>
      </section>
    </div>
  </div>
</template>
