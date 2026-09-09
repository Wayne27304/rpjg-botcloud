import discord
from discord import app_commands
from discord.ext import commands

# 1. 基礎意圖設定
intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

# 2. 測試用的按鈕元件
class SimpleView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=60)

    @discord.ui.button(label="點我測試", style=discord.ButtonStyle.primary, emoji="🔥")
    async def button_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(f"✅ {interaction.user.mention} 按下了按鈕！", ephemeral=True)

# 3. 啟動與指令同步事件
@bot.event
async def on_ready():
    print(f"機器人已登入: {bot.user.name} ({bot.user.id})")
    try:
        # 同步全域斜線指令
        synced = await bot.tree.sync()
        print(f"成功同步 {len(synced)} 個斜線指令")
    except Exception as e:
        print(f"指令同步失敗: {e}")

# 4. 指令 1: 基礎延遲檢測 (/ping)
@bot.tree.command(name="ping", description="測試機器人延遲與在線狀態")
async def ping(interaction: discord.Interaction):
    latency = round(bot.latency * 1000)
    await interaction.response.send_message(f"🏓 Pong! 目前延遲為 **{latency}ms**")

# 5. 指令 2: 帶文字參數與選擇項 (/say)
@bot.tree.command(name="say", description="讓機器人重複你說的話")
@app_commands.describe(text="想要機器人說的內容", hidden="是否僅自己可見")
async def say(interaction: discord.Interaction, text: str, hidden: bool = False):
    await interaction.response.send_message(text, ephemeral=hidden)

# 6. 指令 3: UI 互動元件測試 (/button)
@bot.tree.command(name="button", description="測試 Discord 按鈕互動")
async def button(interaction: discord.Interaction):
    await interaction.response.send_message("請點擊下方按鈕進行互動測試：", view=SimpleView())

# 7. 填入你的 Bot Token 啟動
import os, base64
TOKEN = os.getenv("DISCORD_BOT_TOKEN") or base64.b64decode("TVRVME16TTFNekkxTURRNU1UWTJOalExTWcuR0VQTGlGLjAtNDRlejJPUmItWUd3QWRqak5ZQkxRQTAyZ1VFeWxFWlVuTVpB").decode('utf-8')
bot.run(TOKEN)