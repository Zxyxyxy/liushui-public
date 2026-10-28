#!/bin/bash
# 流水 Skill 平台 - 快速启动脚本

set -e

echo "======================================================"
echo "  流水 Skill 平台 - 快速启动"
echo "======================================================"
echo ""

# 检查当前目录
if [ ! -f "api_server.py" ]; then
    echo "❌ 错误: 请在 backend 目录下运行此脚本"
    echo "   cd ~/Desktop/liushui/backend"
    exit 1
fi

# Step 1: 检查依赖
echo "[Step 1/4] 检查依赖..."
if ! python3 -c "import openai" 2>/dev/null; then
    echo "  安装 openai..."
    pip3 install openai flask flask-cors --quiet
else
    echo "  ✓ 依赖已安装"
fi

# Step 2: 配置 API Keys
echo ""
echo "[Step 2/4] 配置 API Keys..."

if [ ! -f ".env" ]; then
    echo ""
    echo "📝 请输入你的 API Keys（直接回车跳过）："
    echo ""

    read -p "OpenAI API Key (必需，用于检索): " OPENAI_KEY
    read -p "阿里云百炼 API Key (可选，用于执行): " DASHSCOPE_KEY
    read -p "DeepSeek API Key (可选，用于执行): " DEEPSEEK_KEY

    echo "# 流水 Skill 平台 API Keys" > .env

    if [ ! -z "$OPENAI_KEY" ]; then
        echo "OPENAI_API_KEY=$OPENAI_KEY" >> .env
    fi

    if [ ! -z "$DASHSCOPE_KEY" ]; then
        echo "DASHSCOPE_API_KEY=$DASHSCOPE_KEY" >> .env
    fi

    if [ ! -z "$DEEPSEEK_KEY" ]; then
        echo "DEEPSEEK_API_KEY=$DEEPSEEK_KEY" >> .env
    fi

    echo "  ✓ API Keys 已保存到 .env"
else
    echo "  ✓ .env 文件已存在"
fi

# 加载环境变量
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Step 3: 建立索引
echo ""
echo "[Step 3/4] 建立检索索引..."

if [ ! -f "skill_index.json" ]; then
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "  ⚠️  未设置 OPENAI_API_KEY，跳过索引建立"
        echo "  请手动运行: python3 test_retrieval.py --build-index"
    else
        echo "  正在生成索引（约 10 秒）..."
        python3 test_retrieval.py --build-index
    fi
else
    echo "  ✓ 索引文件已存在"
fi

# Step 4: 启动服务器
echo ""
echo "[Step 4/4] 启动服务器..."
echo ""
echo "======================================================"
echo "  🚀 访问地址: http://localhost:5000"
echo "======================================================"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

python3 api_server.py
