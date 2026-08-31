#include <functional>
#include <iostream>

int main() {
    std::function<void()> callback;
    try {
        callback();
    } catch (const std::bad_function_call&) {
        std::cout << "empty call\n";
    }

    int counter = 0;
    callback = [&counter] { ++counter; };
    callback();
    std::cout << "count=" << counter << '\n';
}
