#!/bin/bash

# Azure Web App Environment Variables Setup
# Replace <YOUR_APP_NAME> and <YOUR_RESOURCE_GROUP> with your actual values

APP_NAME="<YOUR_APP_NAME>"
RESOURCE_GROUP="<YOUR_RESOURCE_GROUP>"

# Set environment variables
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    VITE_SUPABASE_URL="https://tlajzziavbnfomhfwofw.supabase.co" \
    VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY="sb_publishable_2rjBTEPGo2DMqtp4P9Ki6g_sAF3kUCf" \
    VITE_WEB3FORMS_ACCESS_KEY="af5299fb-b41b-4c90-8f55-561fcd03cffa"

echo "Environment variables configured successfully!"
echo "Restarting app service..."

# Restart the app service
az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP

echo "Done! Your app should now have access to Supabase."
