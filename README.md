# Coinbase to Income Statement PDF Converter

This script converts your Coinbase transaction CSV data into a professional PDF income statement suitable for NY State of Health insurance applications.

## What it does

- Reads your `transactions.csv` file
- Filters for income transactions only (Receive, Card rebate reward, Rewards)
- Calculates monthly income totals
- Generates a professional PDF with:
  - Total income summary
  - Monthly breakdown table
  - Income source explanations
  - Professional formatting suitable for official use

## Quick Start

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Make sure your `transactions.csv` file is in the same directory**

3. **Run the script:**
   ```bash
   python create_income_pdf.py
   ```

4. **Get your PDF:** The script will create `income_statement_nys.pdf`

## What you get

The generated PDF includes:
- ✅ Professional title and formatting
- ✅ Total income calculation
- ✅ Monthly income breakdown table
- ✅ Income source explanations
- ✅ Verification details
- ✅ Certification section
- ✅ Signature lines

## Customization

You can modify the script to:
- Change the output filename
- Adjust formatting and colors
- Add additional sections
- Modify the income calculation logic

## Troubleshooting

- **Missing dependencies:** Run `pip install -r requirements.txt`
- **CSV not found:** Make sure `transactions.csv` is in the same directory
- **Permission errors:** Check file permissions on your CSV file

## Output

The script will show you:
- Monthly income breakdown in the console
- Total income amount
- Period covered
- Confirmation when PDF is created

Your PDF will be ready to submit to NY State of Health! 🎉