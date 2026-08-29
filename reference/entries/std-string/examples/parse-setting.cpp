#include <iostream>
#include <string>

int main() {
    const std::string setting{"mode=release"};
    const std::string::size_type separator = setting.find('=');

    if (separator != std::string::npos) {
        const std::string key = setting.substr(0, separator);
        const std::string value = setting.substr(separator + 1);
        std::cout << key << " -> " << value << '\n';
    }
}
