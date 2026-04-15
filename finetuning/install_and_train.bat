@echo off
echo Removing old PyTorch...
pip uninstall torch torchvision torchaudio -y

echo Installing heavy CUDA PyTorch... (This might take 5-10 minutes)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

echo Installing Unsloth...
pip install unsloth "unsloth[cu124] @ git+https://github.com/unslothai/unsloth.git"

echo All Dependencies Installed. Running Training...
python train.py

echo Script finished.
pause
